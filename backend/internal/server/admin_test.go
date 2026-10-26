package server_test

import (
	"net/http"
	"regexp"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/server"
)

var wildcard = regexp.MustCompile(`\{[^}]*\}`)

// Every route on the admin sub-mux is walked, so a route added to the table
// without the guard's behaviour fails here.
func TestEveryAdminRouteIsGuarded(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	noHome := app.SignInAs("nohome@example.com")
	resident := apitest.HomeWithResident(t, app, "resident@example.com")
	admin := app.SignInAsSuperAdmin("admin@example.com")

	routes := server.AdminRoutes()
	if len(routes) == 0 {
		t.Fatal("no admin routes registered")
	}
	for _, r := range routes {
		path := wildcard.ReplaceAllString(r.Probe, "x")
		name := r.Method + " " + path

		res := app.Do(r.Method, path, nil)
		if res.Status != http.StatusUnauthorized || res.Header.Get("WWW-Authenticate") != "Bearer" {
			t.Errorf("%s with no token = %d %v, want 401 with WWW-Authenticate: Bearer", name, res.Status, res.Header)
		}
		res = app.Do(r.Method, path, http.Header{"Authorization": {"Bearer garbage"}})
		if res.Status != http.StatusUnauthorized {
			t.Errorf("%s with a garbage token = %d, want 401", name, res.Status)
		}
		for who, c := range map[string]*apitest.Client{"user with no home": noHome, "resident": resident} {
			res = c.Do(r.Method, path, nil, nil)
			if res.Status != http.StatusForbidden || res.Body["error"] != "forbidden" {
				t.Errorf("%s as %s = %d %s, want 403 forbidden", name, who, res.Status, res.Raw)
			}
		}
		res = admin.Do(r.Method, path, nil, nil)
		if res.Status != http.StatusOK {
			t.Errorf("%s as super admin = %d %s, want 200", name, res.Status, res.Raw)
		}
	}
}

func TestUnknownAdminPathIsDeniedByDefault(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	if res := app.Get("/admin/nope"); res.Status != http.StatusUnauthorized {
		t.Errorf("no token = %d, want 401", res.Status)
	}
	if res := app.SignInAs("a@example.com").Get("/admin/nope"); res.Status != http.StatusForbidden {
		t.Errorf("non-admin = %d, want 403 (not 404)", res.Status)
	}
	if res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/nope"); res.Status != http.StatusNotFound {
		t.Errorf("super admin = %d, want 404", res.Status)
	}
}

func TestSuperAdminReadCreatesNoUser(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	admin := app.SignInAsSuperAdmin("admin@example.com")
	before := apitest.Count(t, app, `SELECT count(*) FROM users`)

	if res := admin.Get("/admin/me"); res.Status != http.StatusOK {
		t.Fatalf("GET /admin/me = %d %s", res.Status, res.Raw)
	}
	if res := app.SignInAs("a@example.com").Get("/admin/me"); res.Status != http.StatusForbidden {
		t.Fatalf("non-admin = %d, want 403", res.Status)
	}

	if after := apitest.Count(t, app, `SELECT count(*) FROM users`); after != before {
		t.Fatalf("users rows = %d, want %d: the guard must not create a User", after, before)
	}
}

func TestAdminMeReportsTheEnvironment(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithEnvironment("staging"))

	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/me")

	if res.Status != http.StatusOK || res.Body["environment"] != "staging" {
		t.Fatalf("GET /admin/me = %d %s, want 200 with environment staging", res.Status, res.Raw)
	}
}

func TestAdminRoutesAre503WithoutAuth(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithoutAuth())

	if res := app.Get("/admin/me"); res.Status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", res.Status)
	}
}
