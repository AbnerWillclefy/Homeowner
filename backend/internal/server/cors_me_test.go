package server_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestCORSPreflightForMeIsApprovedWithoutAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins(webOrigin))
	h := fromOrigin(webOrigin)
	h.Set("Access-Control-Request-Method", "GET")
	h.Set("Access-Control-Request-Headers", "authorization")

	res := app.Do(http.MethodOptions, "/me", h)

	if res.Status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", res.Status)
	}
	if !strings.Contains(res.Header.Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Fatalf("Access-Control-Allow-Headers = %q, want Authorization", res.Header.Get("Access-Control-Allow-Headers"))
	}

	// The browser must be able to read the 401 too.
	denied := app.Do(http.MethodGet, "/me", fromOrigin(webOrigin))
	if denied.Status != http.StatusUnauthorized || denied.Header.Get("Access-Control-Allow-Origin") != webOrigin {
		t.Fatalf("401 response = %d with origin %q, want 401 with CORS headers", denied.Status, denied.Header.Get("Access-Control-Allow-Origin"))
	}
}
