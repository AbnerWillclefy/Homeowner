package server_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func countUsers(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM users").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestFirstAuthenticatedRequestCreatesTheUserAndLaterOnesReuseIt(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	first := me.Get("/me")
	if first.Status != http.StatusOK || first.Body["email"] != "a@example.com" {
		t.Fatalf("got %d %s, want 200 with the email", first.Status, first.Raw)
	}
	if n := countUsers(t, app); n != 1 {
		t.Fatalf("users = %d, want 1", n)
	}

	app.Clock.Advance(time.Hour)
	second := app.SignInAs("a@example.com").Get("/me")
	if second.Status != http.StatusOK || second.Body["id"] != first.Body["id"] || second.Body["id"] == "" {
		t.Fatalf("second = %d %s, want the same id as %s", second.Status, second.Raw, first.Raw)
	}
	if n := countUsers(t, app); n != 1 {
		t.Fatalf("users = %d after a second request, want 1", n)
	}

	var created, updated time.Time
	err := app.DB.QueryRow(context.Background(), "SELECT created_at, updated_at FROM users").Scan(&created, &updated)
	if err != nil {
		t.Fatal(err)
	}
	if !created.Equal(apitest.StartTime) || !updated.Equal(apitest.StartTime.Add(time.Hour)) {
		t.Errorf("created_at, updated_at = %v, %v; want the clock's time at each request", created, updated)
	}
}

func TestDifferentSignInsAreDifferentUsers(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	a := app.SignInAs("a@example.com").Get("/me")
	b := app.SignInAs("b@example.com").Get("/me")

	if a.Body["email"] != "a@example.com" || b.Body["email"] != "b@example.com" || a.Body["id"] == b.Body["id"] {
		t.Fatalf("a = %s, b = %s; want each its own User", a.Raw, b.Raw)
	}
	if n := countUsers(t, app); n != 2 {
		t.Fatalf("users = %d, want 2", n)
	}
}

func TestSimultaneousFirstRequestsCreateOneUser(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("new@example.com")

	const n = 10
	statuses := make([]int, n)
	ids := make([]any, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res := me.Get("/me")
			statuses[i], ids[i] = res.Status, res.Body["id"]
		}()
	}
	wg.Wait()

	for i := range n {
		if statuses[i] != http.StatusOK || ids[i] != ids[0] {
			t.Fatalf("request %d: status %d id %v, want 200 and id %v", i, statuses[i], ids[i], ids[0])
		}
	}
	if got := countUsers(t, app); got != 1 {
		t.Fatalf("users = %d, want 1", got)
	}
}

func TestChangedEmailUpdatesTheUserButKeepsTheIdentity(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	app.SignInAsSubject("sub-1", "old@example.com").Get("/me")

	got := app.SignInAsSubject("sub-1", "new@example.com").Get("/me")

	if got.Body["email"] != "new@example.com" {
		t.Fatalf("email = %v, want the new one", got.Body["email"])
	}
	if n := countUsers(t, app); n != 1 {
		t.Fatalf("users = %d, want 1", n)
	}
}

func TestPublicRoutesStayOpenWithoutAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))

	for _, path := range []string{"/healthz", "/push/vapid-public-key"} {
		if res := app.Get(path); res.Status != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", path, res.Status)
		}
	}
}

func TestAuthenticatedRoutesAnswer503WhenAuthIsNotConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithoutAuth())

	for _, header := range []http.Header{nil, {"Authorization": {"Bearer anything"}}} {
		res := app.Do(http.MethodGet, "/me", header)
		if res.Status != http.StatusServiceUnavailable || res.Body["error"] != "auth not configured" {
			t.Errorf("got %d %s, want 503 auth not configured", res.Status, res.Raw)
		}
	}
	if res := app.Get("/healthz"); res.Status != http.StatusOK {
		t.Fatalf("healthz = %d, want 200", res.Status)
	}
}

func TestMeRejectsRequestsWithoutAValidBearerToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	cases := []struct {
		name   string
		header http.Header
	}{
		{"no header", nil},
		{"garbage token", http.Header{"Authorization": {"Bearer not-a-token"}}},
		{"empty token", http.Header{"Authorization": {"Bearer "}}},
		{"basic scheme", http.Header{"Authorization": {"Basic dXNlcjpwYXNz"}}},
		{"two tokens", http.Header{"Authorization": {"Bearer a b"}}},
		{"scheme only", http.Header{"Authorization": {"Bearer"}}},
	}
	var first []byte
	for _, c := range cases {
		res := app.Do(http.MethodGet, "/me", c.header)
		if res.Status != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", c.name, res.Status)
		}
		if got := res.Header.Get("WWW-Authenticate"); got != "Bearer" {
			t.Errorf("%s: WWW-Authenticate = %q, want Bearer", c.name, got)
		}
		if res.Body["error"] != "unauthorized" {
			t.Errorf("%s: body = %s, want the unauthorized error", c.name, res.Raw)
		}
		if first == nil {
			first = res.Raw
		} else if string(first) != string(res.Raw) {
			t.Errorf("%s: body differs between causes: %s vs %s", c.name, res.Raw, first)
		}
	}
}
