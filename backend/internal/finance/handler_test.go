package finance_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAllowedUserSeesFinanceStatusAndFlag(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinanceAllowlist("ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	res := ana.Get("/me/finance")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /me/finance = %d %s", res.Status, res.Raw)
	}
	if got, ok := res.Body["configured"]; !ok || got != false || len(res.Body) != 1 {
		t.Errorf("body = %s, want {\"configured\":false}", res.Raw)
	}
	if me := ana.Get("/me"); me.Body["finance"] != true {
		t.Errorf("GET /me finance = %v, want true", me.Body["finance"])
	}
	if res := ana.Get("/me/finance/anything"); res.Status != http.StatusNotFound {
		t.Errorf("allowed user, unknown subpath = %d, want 404", res.Status)
	}
}

func TestUserNotOnTheListIsRefused(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinanceAllowlist("ana@example.com"))
	bob := app.SignInAs("bob@example.com")

	for _, p := range []string{"/me/finance", "/me/finance/", "/me/finance/anything"} {
		if res := bob.Get(p); res.Status != http.StatusForbidden || res.Body["error"] != "forbidden" {
			t.Errorf("GET %s = %d %s, want 403 forbidden", p, res.Status, res.Raw)
		}
	}
	if me := bob.Get("/me"); me.Body["finance"] != false {
		t.Errorf("GET /me finance = %v, want false", me.Body["finance"])
	}
}

func TestEmptyOrAbsentListRefusesEveryone(t *testing.T) {
	t.Parallel()
	for name, opts := range map[string][]apitest.Option{
		"absent": nil,
		"empty":  {apitest.WithFinanceAllowlist()},
	} {
		app := apitest.Start(t, opts...)
		c := app.SignInAs("ana@example.com")
		if res := c.Get("/me/finance"); res.Status != http.StatusForbidden {
			t.Errorf("%s list: GET /me/finance = %d, want 403", name, res.Status)
		}
		if me := c.Get("/me"); me.Body["finance"] != false {
			t.Errorf("%s list: finance = %v, want false", name, me.Body["finance"])
		}
	}
}

func TestEmailMatchingIgnoresCase(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinanceAllowlist("Ana@Example.com"))
	ana := app.SignInAs("ana@example.COM")

	if res := ana.Get("/me/finance"); res.Status != http.StatusOK {
		t.Errorf("GET /me/finance = %d %s, want 200", res.Status, res.Raw)
	}
}

func TestRenameKeepsFinanceFlag(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinanceAllowlist("ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	res := ana.Put("/me/name", map[string]any{"name": "Ana"})
	if res.Status != http.StatusOK || res.Body["finance"] != true {
		t.Errorf("PUT /me/name = %d %s, want 200 with finance true", res.Status, res.Raw)
	}
}

func TestNoTokenIs401NotForbidden(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinanceAllowlist("ana@example.com"))
	if res := app.Get("/me/finance"); res.Status != http.StatusUnauthorized {
		t.Errorf("GET /me/finance without token = %d, want 401", res.Status)
	}
}
