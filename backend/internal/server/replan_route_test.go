package server_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// The staging replan route is gone: a manual GitHub workflow invokes the
// Allocation function instead (.github/workflows/replan-staging.yml).
func TestReplanRouteIsGone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	c := apitest.HomeWithResident(t, app, "ana@example.com")

	signedIn := c.Post("/dev/replan", nil)
	anonymous := app.Post("/dev/replan", nil)

	for name, r := range map[string]apitest.Response{"signed in": signedIn, "anonymous": anonymous} {
		if r.Status != http.StatusNotFound || r.Body["error"] != "not found" {
			t.Errorf("%s: got %d %s, want 404 not found", name, r.Status, r.Raw)
		}
	}
}
