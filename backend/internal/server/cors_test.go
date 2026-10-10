package server_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

const webOrigin = "http://localhost:5173"

func fromOrigin(origin string) http.Header {
	return http.Header{"Origin": {origin}}
}

func TestCORSAllowedOriginGetsAllowOriginHeader(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins("https://other.example.com", webOrigin))

	res := app.Do(http.MethodGet, "/healthz", fromOrigin(webOrigin))

	if res.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.Status)
	}
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != webOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, webOrigin)
	}
	if !strings.Contains(res.Header.Get("Vary"), "Origin") {
		t.Fatalf("Vary = %q, want Origin", res.Header.Get("Vary"))
	}
}

func TestCORSDisallowedOriginGetsNoCORSHeaders(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins(webOrigin))

	res := app.Do(http.MethodGet, "/healthz", fromOrigin("https://evil.example.com"))

	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want none", got)
	}
}

func TestCORSIsOffWhenNoOriginsAreConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	res := app.Do(http.MethodGet, "/healthz", fromOrigin(webOrigin))

	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want none", got)
	}
}

func TestCORSPreflightReturns204WithAllowHeaders(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins(webOrigin))
	h := fromOrigin(webOrigin)
	h.Set("Access-Control-Request-Method", "POST")
	h.Set("Access-Control-Request-Headers", "authorization, content-type")

	res := app.Do(http.MethodOptions, "/healthz", h)

	if res.Status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", res.Status)
	}
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != webOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, webOrigin)
	}
	for _, want := range []string{"Authorization", "Content-Type"} {
		if !strings.Contains(res.Header.Get("Access-Control-Allow-Headers"), want) {
			t.Fatalf("Access-Control-Allow-Headers = %q, want %s", res.Header.Get("Access-Control-Allow-Headers"), want)
		}
	}
	for _, want := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		if !strings.Contains(res.Header.Get("Access-Control-Allow-Methods"), want) {
			t.Fatalf("Access-Control-Allow-Methods = %q, want %s", res.Header.Get("Access-Control-Allow-Methods"), want)
		}
	}
}

func TestCORSPreflightFromDisallowedOriginIsNotApproved(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins(webOrigin))
	h := fromOrigin("https://evil.example.com")
	h.Set("Access-Control-Request-Method", "POST")

	res := app.Do(http.MethodOptions, "/healthz", h)

	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want none", got)
	}
}

func TestCORSHeadersAlsoOnErrorResponses(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithCORSAllowedOrigins(webOrigin))
	app.DB.Close()

	res := app.Do(http.MethodGet, "/healthz", fromOrigin(webOrigin))

	if res.Status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", res.Status)
	}
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != webOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q on the 503", got, webOrigin)
	}
}
