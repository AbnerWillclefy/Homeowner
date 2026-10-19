package photos_test

import (
	"bytes"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/photos"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

var (
	webpBytes = append([]byte("RIFF\x10\x00\x00\x00WEBPVP8 "), bytes.Repeat([]byte{1}, 20)...)
	jpegBytes = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{2}, 20)...)
	pngBytes  = append([]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), bytes.Repeat([]byte{3}, 20)...)
)

func myID(t *testing.T, c *apitest.Client) string {
	t.Helper()
	id, _ := c.Get("/me").Body["id"].(string)
	if id == "" {
		t.Fatal("no user id")
	}
	return id
}

func photoURLOf(t *testing.T, c *apitest.Client) any {
	t.Helper()
	res := c.Get("/me")
	apitest.ExpectStatus(t, res, http.StatusOK)
	v, ok := res.Body["photoUrl"]
	if !ok {
		t.Fatalf("no photoUrl in %s", res.Raw)
	}
	return v
}

// presign asks for an upload and returns the pending key.
func presign(t *testing.T, c *apitest.Client, contentType string, size int) string {
	t.Helper()
	res := c.Post("/me/photo/uploads", map[string]any{"contentType": contentType, "size": size})
	apitest.ExpectStatus(t, res, http.StatusOK)
	key, _ := res.Body["key"].(string)
	return key
}

func confirm(c *apitest.Client, key string) apitest.Response {
	return c.Put("/me/photo", map[string]any{"key": key})
}

// uploaded presigns, simulates the browser's upload and returns the key.
func uploaded(t *testing.T, app *apitest.App, c *apitest.Client, contentType string, b []byte) string {
	t.Helper()
	key := presign(t, c, contentType, len(b))
	app.Photos.Upload(key, b, contentType)
	return key
}

// stored puts an object under a fresh pending key without presigning, for
// bytes the presign would refuse.
func stored(t *testing.T, app *apitest.App, c *apitest.Client, contentType string, b []byte) string {
	t.Helper()
	key := photos.NewPendingKey(myID(t, c))
	app.Photos.Upload(key, b, contentType)
	return key
}

func avatarKeys(app *apitest.App) []string {
	var out []string
	for k := range app.Photos.Objects() {
		if strings.HasPrefix(k, "avatars/") {
			out = append(out, k)
		}
	}
	return out
}

func TestPresignAcceptsTheTwoTypesUpToTheLimit(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	c := app.SignInAs("a@example.com")
	id := myID(t, c)

	for _, ct := range []string{"image/webp", "image/jpeg"} {
		for _, size := range []int{1, 524288} {
			res := c.Post("/me/photo/uploads", map[string]any{"contentType": ct, "size": size})
			apitest.ExpectStatus(t, res, http.StatusOK)
			key, _ := res.Body["key"].(string)
			if !photos.OwnsPendingKey(id, key) {
				t.Errorf("key %q is not a pending key of mine", key)
			}
			if res.Body["method"] != "PUT" {
				t.Errorf("method = %v", res.Body["method"])
			}
			if u, _ := res.Body["url"].(string); u == "" {
				t.Error("no url")
			}
			if h, _ := res.Body["headers"].(map[string]any); h["Content-Type"] != ct {
				t.Errorf("headers = %v", res.Body["headers"])
			}
			if res.Body["expiresAt"] != app.Clock.Now().Add(photos.UploadTTL).UTC().Format("2006-01-02T15:04:05Z") {
				t.Errorf("expiresAt = %v", res.Body["expiresAt"])
			}
		}
	}
	got := app.Photos.Presigned()
	if len(got) != 4 || got[0].ContentType != "image/webp" || got[0].Size != 1 || got[3].ContentType != "image/jpeg" || got[3].Size != 524288 {
		t.Errorf("fake recorded %+v", got)
	}
}

func TestPresignRejectsOtherTypesAndSizes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	c := app.SignInAs("a@example.com")
	for name, tc := range map[string]struct {
		ct   string
		size int
		code string
	}{
		"too big":   {"image/webp", 524289, "invalid_size"},
		"zero":      {"image/webp", 0, "invalid_size"},
		"negative":  {"image/jpeg", -1, "invalid_size"},
		"png":       {"image/png", 100, "invalid_type"},
		"svg":       {"image/svg+xml", 100, "invalid_type"},
		"image/jpg": {"image/jpg", 100, "invalid_type"},
	} {
		res := c.Post("/me/photo/uploads", map[string]any{"contentType": tc.ct, "size": tc.size})
		if res.Status != http.StatusBadRequest || res.Body["error"] != tc.code {
			t.Errorf("%s: %d %s, want 400 %s", name, res.Status, res.Raw, tc.code)
		}
	}
	if n := len(app.Photos.Presigned()); n != 0 {
		t.Errorf("%d presigns recorded for rejected requests", n)
	}
}

func TestConfirmFailuresAnswer400AndChangeNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	a := app.SignInAs("a@example.com")
	b := app.SignInAs("b@example.com")

	bsKey := uploaded(t, app, b, "image/webp", webpBytes)
	big := bytes.Repeat([]byte{1}, 600*1024)
	copy(big, webpBytes)

	for name, tc := range map[string]struct {
		key  string
		code string
	}{
		"malformed key":   {"avatars/whatever.webp", "invalid_key"},
		"other users key": {bsKey, "invalid_key"},
		"never uploaded":  {photos.NewPendingKey(myID(t, a)), "not_found"},
		"600 KB":          {stored(t, app, a, "image/webp", big), "invalid_object"},
		"stored as png":   {stored(t, app, a, "image/png", pngBytes), "invalid_object"},
		"webp but png":    {uploaded(t, app, a, "image/webp", pngBytes), "not_an_image"},
		"webp but text":   {uploaded(t, app, a, "image/webp", []byte("hello, not an image")), "not_an_image"},
		"jpeg but webp":   {uploaded(t, app, a, "image/jpeg", webpBytes), "not_an_image"},
	} {
		res := confirm(a, tc.key)
		if res.Status != http.StatusBadRequest || res.Body["error"] != tc.code {
			t.Errorf("%s: %d %s, want 400 %s", name, res.Status, res.Raw, tc.code)
		}
		if v := photoURLOf(t, a); v != nil {
			t.Errorf("%s: photoUrl = %v, want unchanged (null)", name, v)
		}
	}
	if n := len(avatarKeys(app)); n != 0 {
		t.Errorf("%d avatars promoted by failed confirms", n)
	}
	if _, ok := app.Photos.Objects()[bsKey]; !ok {
		t.Error("another user's pending object was touched")
	}
}

func TestConfirmPromotesStoresAndShowsThePhotoToHousemates(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")

	pending := uploaded(t, app, a, "image/webp", webpBytes)
	res := confirm(a, pending)
	apitest.ExpectStatus(t, res, http.StatusOK)

	keys := avatarKeys(app)
	if len(keys) != 1 || !strings.HasSuffix(keys[0], ".webp") {
		t.Fatalf("avatars = %v", keys)
	}
	obj := app.Photos.Objects()[keys[0]]
	if obj.CacheControl != photos.CacheControl || obj.ContentType != "image/webp" {
		t.Errorf("avatar = %+v", obj)
	}
	want := apitest.PhotosBaseURL + "/" + strings.TrimPrefix(keys[0], "avatars/")
	if res.Body["photoUrl"] != want {
		t.Errorf("photoUrl = %v, want %s", res.Body["photoUrl"], want)
	}
	if photoURLOf(t, a) != want {
		t.Errorf("GET /me photoUrl = %v", photoURLOf(t, a))
	}
	if _, ok := app.Photos.Objects()[pending]; ok {
		t.Error("pending object was not deleted")
	}

	got := b.Get("/home/residents")
	apitest.ExpectStatus(t, got, http.StatusOK)
	if !strings.Contains(string(got.Raw), `"photoUrl":"`+want+`"`) {
		t.Errorf("housemate sees %s, want photoUrl %s", got.Raw, want)
	}
	if strings.Contains(string(got.Raw), "pending/") || strings.Contains(string(got.Raw), "photoKey") {
		t.Errorf("residents leak storage details: %s", got.Raw)
	}
	// Confirming the same pending key again: it is gone.
	if r := confirm(a, pending); r.Status != http.StatusBadRequest || r.Body["error"] != "not_found" {
		t.Errorf("second confirm = %d %s", r.Status, r.Raw)
	}
}

func TestReplacingDeletesThePreviousPhotoAndAFailedCleanupIsLogged(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	c := app.SignInAs("a@example.com")

	apitest.ExpectStatus(t, confirm(c, uploaded(t, app, c, "image/webp", webpBytes)), http.StatusOK)
	first := avatarKeys(app)[0]
	apitest.ExpectStatus(t, confirm(c, uploaded(t, app, c, "image/jpeg", jpegBytes)), http.StatusOK)
	keys := avatarKeys(app)
	if len(keys) != 1 || keys[0] == first || !strings.HasSuffix(keys[0], ".jpg") {
		t.Fatalf("avatars after replace = %v (first %s)", keys, first)
	}

	second := keys[0]
	app.Photos.FailDelete(second)
	res := confirm(c, uploaded(t, app, c, "image/webp", webpBytes))
	apitest.ExpectStatus(t, res, http.StatusOK)
	if _, ok := app.Photos.Objects()[second]; !ok {
		t.Error("the failing delete should have left the old photo")
	}
	if !app.Logs.Contains(`"level":"WARN"`) || !app.Logs.Contains(second) {
		t.Errorf("no warning naming %s in the logs", second)
	}
	if photoURLOf(t, c) != res.Body["photoUrl"] {
		t.Error("User does not show the new photo")
	}
}

func TestRemovingClearsThePhotoAndIsIdempotent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	c := app.SignInAs("a@example.com")

	apitest.ExpectStatus(t, c.Delete("/me/photo"), http.StatusNoContent)
	apitest.ExpectStatus(t, confirm(c, uploaded(t, app, c, "image/webp", webpBytes)), http.StatusOK)
	apitest.ExpectStatus(t, c.Delete("/me/photo"), http.StatusNoContent)

	if v := photoURLOf(t, c); v != nil {
		t.Errorf("photoUrl = %v, want null", v)
	}
	if n := len(avatarKeys(app)); n != 0 {
		t.Errorf("%d avatars left", n)
	}
	apitest.ExpectStatus(t, c.Delete("/me/photo"), http.StatusNoContent)
}

func TestAFailedDeleteOnRemovalStillAnswers204(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	c := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, confirm(c, uploaded(t, app, c, "image/webp", webpBytes)), http.StatusOK)
	app.Photos.FailDelete(avatarKeys(app)[0])
	apitest.ExpectStatus(t, c.Delete("/me/photo"), http.StatusNoContent)
	if v := photoURLOf(t, c); v != nil {
		t.Errorf("photoUrl = %v, want null", v)
	}
}

func TestPhotoRoutesAnswer503WhenNotConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	c := app.SignInAs("a@example.com")

	for _, res := range []apitest.Response{
		c.Post("/me/photo/uploads", map[string]any{"contentType": "image/webp", "size": 10}),
		c.Put("/me/photo", map[string]any{"key": "x"}),
		c.Delete("/me/photo"),
	} {
		if res.Status != http.StatusServiceUnavailable || res.Body["error"] != "photos not configured" {
			t.Errorf("%d %s, want 503 photos not configured", res.Status, res.Raw)
		}
	}
	if v := photoURLOf(t, c); v != nil {
		t.Errorf("photoUrl = %v, want null", v)
	}
}

func TestPhotoRoutesNeedSignIn(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPhotos())
	apitest.ExpectStatus(t, app.Post("/me/photo/uploads", map[string]any{"contentType": "image/webp", "size": 10}), http.StatusUnauthorized)
}
