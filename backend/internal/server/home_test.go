package server_test

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func countHomes(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM homes").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func homeBody(tz, at string) map[string]any {
	return map[string]any{"timezone": tz, "allocationTime": at}
}

func TestAUserCreatesAHomeAndReadsItBack(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	created := me.Post("/home", homeBody("America/Sao_Paulo", "07:30"))
	if created.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s, want 201", created.Status, created.Raw)
	}
	if created.Body["id"] == "" || created.Body["id"] == nil {
		t.Fatalf("created Home has no id: %s", created.Raw)
	}

	got := me.Get("/home")
	if got.Status != http.StatusOK {
		t.Fatalf("GET /home = %d %s, want 200", got.Status, got.Raw)
	}
	if got.Body["id"] != created.Body["id"] || got.Body["timezone"] != "America/Sao_Paulo" || got.Body["allocationTime"] != "07:30" {
		t.Fatalf("GET /home = %s, want the created settings", got.Raw)
	}
}

func TestASecondHomeForTheSameUserIsRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", homeBody("UTC", "07:00"))

	second := me.Post("/home", homeBody("Europe/Lisbon", "08:00"))
	if second.Status != http.StatusConflict || second.Body["error"] != "already a resident" {
		t.Fatalf("second POST = %d %s, want 409 already a resident", second.Status, second.Raw)
	}
	got := me.Get("/home")
	if got.Body["timezone"] != "UTC" || got.Body["allocationTime"] != "07:00" {
		t.Fatalf("GET /home = %s, want the first settings", got.Raw)
	}
	if n := countHomes(t, app); n != 1 {
		t.Fatalf("homes = %d, want 1 (no orphan from the rejected create)", n)
	}
}

func TestConcurrentCreatesMakeOneHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Get("/me") // the User exists before the race

	const n = 8
	statuses := make([]int, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = me.Post("/home", homeBody("UTC", "07:00")).Status
		}()
	}
	wg.Wait()

	created := 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v, want only 201 and 409", statuses)
		}
	}
	if created != 1 {
		t.Fatalf("statuses = %v, want exactly one 201", statuses)
	}
	if got := countHomes(t, app); got != 1 {
		t.Fatalf("homes = %d, want 1", got)
	}
}

func TestDifferentUsersGetTheirOwnHomes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := app.SignInAs("a@example.com")
	b := app.SignInAs("b@example.com")

	ra := a.Post("/home", homeBody("UTC", "07:00"))
	rb := b.Post("/home", homeBody("Asia/Tokyo", "09:15"))
	if ra.Status != http.StatusCreated || rb.Status != http.StatusCreated {
		t.Fatalf("creates = %d, %d, want 201 both", ra.Status, rb.Status)
	}
	if ra.Body["id"] == rb.Body["id"] {
		t.Fatalf("both Users got Home %v", ra.Body["id"])
	}
	if got := b.Get("/home"); got.Body["timezone"] != "Asia/Tokyo" {
		t.Fatalf("b GET /home = %s, want b's own Home", got.Raw)
	}
	if got := a.Get("/home"); got.Body["timezone"] != "UTC" {
		t.Fatalf("a GET /home = %s, want a's own Home", got.Raw)
	}
}

func TestHomeRoutesWithoutAHomeOrAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for _, tc := range []struct {
		method string
		body   any
	}{{http.MethodGet, nil}, {http.MethodPut, homeBody("UTC", "07:00")}} {
		res := me.Do(tc.method, "/home", tc.body, nil)
		if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
			t.Errorf("%s /home without a Home = %d %s, want 404 no home", tc.method, res.Status, res.Raw)
		}
	}
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut} {
		if res := app.Do(method, "/home", nil); res.Status != http.StatusUnauthorized {
			t.Errorf("%s /home without a token = %d, want 401", method, res.Status)
		}
	}
	if n := countHomes(t, app); n != 0 {
		t.Fatalf("homes = %d, want 0", n)
	}
}

func TestHomeRoutesAnswer503WhenAuthIsNotConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithoutAuth())
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut} {
		if res := app.Do(method, "/home", nil); res.Status != http.StatusServiceUnavailable {
			t.Errorf("%s /home = %d, want 503", method, res.Status)
		}
	}
}

func TestEditingTheHomeSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", homeBody("UTC", "07:00"))

	put := me.Put("/home", homeBody("America/Sao_Paulo", "18:45"))
	if put.Status != http.StatusOK || put.Body["timezone"] != "America/Sao_Paulo" || put.Body["allocationTime"] != "18:45" {
		t.Fatalf("PUT /home = %d %s, want 200 with the new settings", put.Status, put.Raw)
	}
	got := me.Get("/home")
	if got.Body["timezone"] != "America/Sao_Paulo" || got.Body["allocationTime"] != "18:45" {
		t.Fatalf("GET /home = %s, want the new settings", got.Raw)
	}
}

func TestInvalidHomeSettingsAreRejectedWithFieldCodes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", homeBody("UTC", "07:00"))

	cases := []struct {
		name   string
		body   map[string]any
		fields map[string]string
	}{
		{"empty timezone", homeBody("", "07:00"), map[string]string{"timezone": "required"}},
		{"unknown timezone", homeBody("Mars/Olympus", "07:00"), map[string]string{"timezone": "unknown"}},
		{"Local timezone", homeBody("Local", "07:00"), map[string]string{"timezone": "unknown"}},
		{"missing time", map[string]any{"timezone": "UTC"}, map[string]string{"allocationTime": "required"}},
		{"unpadded time", homeBody("UTC", "7:5"), map[string]string{"allocationTime": "invalid"}},
		{"hour out of range", homeBody("UTC", "25:00"), map[string]string{"allocationTime": "invalid"}},
		{"seconds", homeBody("UTC", "07:00:00"), map[string]string{"allocationTime": "invalid"}},
		{"not a quarter hour", homeBody("UTC", "07:10"), map[string]string{"allocationTime": "not_quarter_hour"}},
		{"both wrong", homeBody("Nope", "07:10"), map[string]string{"timezone": "unknown", "allocationTime": "not_quarter_hour"}},
	}
	for _, tc := range cases {
		for _, method := range []string{http.MethodPost, http.MethodPut} {
			res := me.Do(method, "/home", tc.body, nil)
			if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid home" {
				t.Errorf("%s %s = %d %s, want 400 invalid home", tc.name, method, res.Status, res.Raw)
				continue
			}
			fields, _ := res.Body["fields"].(map[string]any)
			if len(fields) != len(tc.fields) {
				t.Errorf("%s %s fields = %v, want %v", tc.name, method, fields, tc.fields)
			}
			for k, want := range tc.fields {
				if fields[k] != want {
					t.Errorf("%s %s fields[%s] = %v, want %s", tc.name, method, k, fields[k], want)
				}
			}
		}
	}

	got := me.Get("/home")
	if got.Body["timezone"] != "UTC" || got.Body["allocationTime"] != "07:00" {
		t.Fatalf("GET /home = %s, want the settings unchanged", got.Raw)
	}
}

func TestInvalidHomeBodiesAreRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for name, raw := range map[string]string{
		"not JSON":      `{`,
		"unknown field": `{"timezone":"UTC","allocationTime":"07:00","extra":1}`,
		"wrong type":    `{"timezone":5,"allocationTime":"07:00"}`,
	} {
		if res := me.SendRaw(http.MethodPost, "/home", []byte(raw)); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, res.Status, res.Raw)
		}
	}
	big := []byte(`{"timezone":"` + strings.Repeat("a", 20*1024) + `"}`)
	if res := me.SendRaw(http.MethodPost, "/home", big); res.Status != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized body = %d, want 413", res.Status)
	}
	if n := countHomes(t, app); n != 0 {
		t.Fatalf("homes = %d, want 0", n)
	}
}

func TestAnyResidentCanEditTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	owner := app.SignInAs("a@example.com")
	home := owner.Post("/home", homeBody("UTC", "07:00"))

	other := app.SignInAs("b@example.com")
	other.JoinHome(t, home.Body["id"].(string))

	put := other.Put("/home", homeBody("Europe/Lisbon", "21:00"))
	if put.Status != http.StatusOK {
		t.Fatalf("second Resident PUT /home = %d %s, want 200", put.Status, put.Raw)
	}
	got := owner.Get("/home")
	if got.Body["timezone"] != "Europe/Lisbon" || got.Body["allocationTime"] != "21:00" {
		t.Fatalf("first Resident GET /home = %s, want the second Resident's edit", got.Raw)
	}
	if n := other.Post("/home", homeBody("UTC", "07:00")).Status; n != http.StatusConflict {
		t.Fatalf("a Resident creating another Home = %d, want 409", n)
	}
}
