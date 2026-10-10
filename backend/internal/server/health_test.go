package server_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func TestHealthzReturnsOKWhenDatabaseIsUp(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	res := app.Get("/healthz")

	if res.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", res.Status, res.Raw)
	}
	if got := res.Body["status"]; got != "ok" {
		t.Fatalf(`body status = %v, want "ok"`, got)
	}
	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
}

func TestHealthzReturns503WhenDatabaseIsUnreachable(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	app.DB.Close()

	res := app.Get("/healthz")

	if res.Status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", res.Status)
	}
	if got := res.Body["status"]; got != "unavailable" {
		t.Fatalf(`body status = %v, want "unavailable"`, got)
	}
}

func TestUnknownRouteReturnsJSONError(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	res := app.Get("/nope")

	if res.Status != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", res.Status)
	}
	if !strings.HasPrefix(res.Header.Get("Content-Type"), "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", res.Header.Get("Content-Type"))
	}
	if _, ok := res.Body["error"]; !ok {
		t.Fatalf("body %s has no error field", res.Raw)
	}
}

func TestServerUsesTheClockFromDeps(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	when := time.Date(2031, 7, 8, 21, 30, 0, 0, time.UTC)
	app.Clock.Set(when)

	app.Get("/healthz")

	if !app.Logs.Contains(`"ts":"2031-07-08T21:30:00Z"`) {
		t.Fatalf("request log does not carry the fake clock time; logs:\n%s", app.Logs.String())
	}
}
