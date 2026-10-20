package users_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

func TestMeCarriesTheAvatarFallbackFromTheShownName(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("maria.silva@example.com")

	res := me.Get("/me")
	if res.Body["initials"] != "MS" {
		t.Errorf("initials = %v, want MS (from the email's local part)", res.Body["initials"])
	}
	tone, _ := res.Body["avatarTone"].(string)
	if !vocab.IsCategory(tone) || tone == "other" {
		t.Errorf("avatarTone = %q, want a pastel Category id", tone)
	}
	id, _ := res.Body["id"].(string)
	if tone != users.AvatarTone(id) {
		t.Errorf("avatarTone = %q, want the one derived from the user id", tone)
	}
	if got := putName(me, "Zé").Body["initials"]; got != "Z" {
		t.Errorf("initials after naming = %v, want Z", got)
	}
}

func putName(c *apitest.Client, name any) apitest.Response {
	return c.Put("/me/name", map[string]any{"name": name})
}

func TestANewUserHasNoDisplayNameAndShowsTheEmailsLocalPart(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	res := app.SignInAs("maria.silva@example.com").Get("/me")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /me = %d %s", res.Status, res.Raw)
	}
	if v, ok := res.Body["displayName"]; !ok || v != nil {
		t.Errorf("displayName = %v (present %v), want null", v, ok)
	}
	if res.Body["name"] != "maria.silva" {
		t.Errorf("name = %v, want maria.silva", res.Body["name"])
	}
	if v, ok := res.Body["photoUrl"]; !ok || v != nil {
		t.Errorf("photoUrl = %v (present %v), want null", v, ok)
	}
}

func TestSettingANameTrimsUnicodeWhitespaceAndAnswersTheUser(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	// Plain spaces, a no-break space and an ideographic space.
	for _, in := range []string{"  Abner  ", " Abner　", " Abner "} {
		res := putName(me, in)
		if res.Status != http.StatusOK || res.Body["displayName"] != "Abner" || res.Body["name"] != "Abner" {
			t.Errorf("PUT %q = %d %s, want 200 with Abner", in, res.Status, res.Raw)
		}
		if res.Body["email"] != "a@example.com" || res.Body["id"] == "" {
			t.Errorf("PUT answer %s lacks the full user", res.Raw)
		}
	}
	if got := me.Get("/me").Body["displayName"]; got != "Abner" {
		t.Errorf("GET /me displayName = %v, want Abner", got)
	}
}

func TestNameLengthCountsCodePoints(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	family := "\U0001F468‍\U0001F469‍\U0001F467‍\U0001F466"

	cases := []struct {
		name string
		in   string
		want int
		code string
	}{
		{"40 accented letters", strings.Repeat("é", 40), http.StatusOK, ""},
		{"40 emoji", strings.Repeat("😀", 40), http.StatusOK, ""},
		{"40 ZWJ families are over 40 code points", strings.Repeat(family, 40), http.StatusBadRequest, "too_long"},
		{"41 ASCII", strings.Repeat("a", 41), http.StatusBadRequest, "too_long"},
		{"control character", "Ab\x07ner", http.StatusBadRequest, "invalid"},
		{"NUL", "Ab\x00ner", http.StatusBadRequest, "invalid"},
		{"newline inside", "Ab\nner", http.StatusBadRequest, "invalid"},
		{"bidi override", "Ab‮ner", http.StatusBadRequest, "invalid"},
		{"bidi isolate", "Ab⁦ner", http.StatusBadRequest, "invalid"},
		{"ZWJ is allowed", family, http.StatusOK, ""},
	}
	for _, c := range cases {
		res := putName(me, c.in)
		if res.Status != c.want {
			t.Errorf("%s: got %d %s, want %d", c.name, res.Status, res.Raw, c.want)
		}
		if c.code != "" && res.Body["error"] != c.code {
			t.Errorf("%s: body %s, want error %s", c.name, res.Raw, c.code)
		}
	}
}

func TestARejectedNameKeepsTheOldOne(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, putName(me, "Abner"), http.StatusOK)

	apitest.ExpectStatus(t, putName(me, strings.Repeat("a", 41)), http.StatusBadRequest)
	if got := me.Get("/me").Body["displayName"]; got != "Abner" {
		t.Errorf("displayName = %v, want Abner kept", got)
	}
}

func TestNullBlankOrMissingNameClearsItAndTheFallbackFollowsTheEmail(t *testing.T) {
	t.Parallel()
	for _, clear := range []any{nil, "", "   ", "　"} {
		app := apitest.Start(t)
		me := app.SignInAsSubject("sub-1", "a@example.com")
		apitest.ExpectStatus(t, putName(me, "Abner"), http.StatusOK)

		res := putName(me, clear)
		if res.Status != http.StatusOK || res.Body["displayName"] != nil || res.Body["name"] != "a" {
			t.Errorf("clear with %#v = %d %s, want null displayName and name a", clear, res.Status, res.Raw)
		}

		// The fallback is computed on read, so it follows an email change.
		again := app.SignInAsSubject("sub-1", "bruno@example.com").Get("/me")
		if again.Body["name"] != "bruno" {
			t.Errorf("after the email changed, name = %v, want bruno", again.Body["name"])
		}
	}

	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, putName(me, "Abner"), http.StatusOK)
	res := me.SendRaw(http.MethodPut, "/me/name", []byte(`{}`))
	if res.Status != http.StatusOK || res.Body["displayName"] != nil {
		t.Errorf("empty object = %d %s, want it to clear", res.Status, res.Raw)
	}
}

func TestANameSurvivesAnEmailChange(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.ExpectStatus(t, putName(app.SignInAsSubject("s", "a@example.com"), "Abner"), http.StatusOK)

	res := app.SignInAsSubject("s", "z@example.com").Get("/me")
	if res.Body["displayName"] != "Abner" || res.Body["name"] != "Abner" {
		t.Errorf("GET /me = %s, want the name kept", res.Raw)
	}
}

func TestTwoUsersMayShareAName(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.ExpectStatus(t, putName(app.SignInAs("a@example.com"), "Sam"), http.StatusOK)
	apitest.ExpectStatus(t, putName(app.SignInAs("b@example.com"), "Sam"), http.StatusOK)
}

func TestUnacceptableNameBodiesAreRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	cases := []struct {
		name string
		body string
		want int
	}{
		{"malformed JSON", `{"name":`, http.StatusBadRequest},
		{"unknown field", `{"name":"a","extra":1}`, http.StatusBadRequest},
		{"name is not a string", `{"name":5}`, http.StatusBadRequest},
		{"oversize body", `{"name":"` + strings.Repeat("x", 4096) + `"}`, http.StatusRequestEntityTooLarge},
	}
	for _, c := range cases {
		if res := me.SendRaw(http.MethodPut, "/me/name", []byte(c.body)); res.Status != c.want {
			t.Errorf("%s: got %d %s, want %d", c.name, res.Status, res.Raw, c.want)
		}
	}
}

func TestSettingANameNeedsAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.ExpectStatus(t, app.Put("/me/name", map[string]any{"name": "x"}), http.StatusUnauthorized)
}

func TestEmailWithoutAtShowsWholeAndOtherwiseThePartBeforeTheLastAt(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	if got := app.SignInAs("odd").Get("/me").Body["name"]; got != "odd" {
		t.Errorf("name = %v, want odd", got)
	}
	if got := app.SignInAs("a@b@example.com").Get("/me").Body["name"]; got != "a@b" {
		t.Errorf("name = %v, want a@b", got)
	}
}
