package replan_test

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/replan"
)

func homeID(t *testing.T, c *apitest.Client) string {
	t.Helper()
	r := c.Get("/home")
	id, _ := r.Body["id"].(string)
	if id == "" {
		t.Fatalf("GET /home = %d %s", r.Status, r.Raw)
	}
	return id
}

func TestReplanRouteDoesNotExistWhenNoReplannerIsConfigured(t *testing.T) {
	app := apitest.Start(t)
	c := apitest.HomeWithResident(t, app, "ana@example.com")

	r := c.Post("/dev/replan", nil)

	if r.Status != http.StatusNotFound || r.Body["error"] != "not found" {
		t.Fatalf("got %d %s, want 404 not found", r.Status, r.Raw)
	}
}

func TestReplanRequiresSignIn(t *testing.T) {
	fake := replan.NewFake()
	app := apitest.Start(t, apitest.WithReplanner(fake))

	r := app.Post("/dev/replan", nil)

	if r.Status != http.StatusUnauthorized {
		t.Fatalf("got %d %s, want 401", r.Status, r.Raw)
	}
	if len(fake.Homes()) != 0 {
		t.Fatal("an unauthenticated request reached the replanner")
	}
}

func TestReplanAsksForTheCallersHomeAndAnswers202(t *testing.T) {
	fake := replan.NewFake()
	app := apitest.Start(t, apitest.WithReplanner(fake))
	c := apitest.HomeWithResident(t, app, "ana@example.com")

	r := c.Post("/dev/replan", nil)

	if r.Status != http.StatusAccepted {
		t.Fatalf("got %d %s, want 202", r.Status, r.Raw)
	}
	if got, want := fake.Homes(), []string{homeID(t, c)}; !slices.Equal(got, want) {
		t.Fatalf("replanned %v, want %v", got, want)
	}
}

func TestReplanIgnoresAHomeNamedInTheBody(t *testing.T) {
	fake := replan.NewFake()
	app := apitest.Start(t, apitest.WithReplanner(fake))
	ana := apitest.HomeWithResident(t, app, "ana@example.com")
	bob := apitest.HomeWithResident(t, app, "bob@example.com")

	r := ana.Post("/dev/replan", map[string]string{"homeId": homeID(t, bob)})

	if r.Status != http.StatusAccepted {
		t.Fatalf("got %d %s, want 202", r.Status, r.Raw)
	}
	if got, want := fake.Homes(), []string{homeID(t, ana)}; !slices.Equal(got, want) {
		t.Fatalf("replanned %v, want only the caller's Home %v", got, want)
	}
}

func TestReplanIgnoresAMalformedBody(t *testing.T) {
	fake := replan.NewFake()
	app := apitest.Start(t, apitest.WithReplanner(fake))
	c := apitest.HomeWithResident(t, app, "ana@example.com")

	r := c.SendRaw(http.MethodPost, "/dev/replan", []byte("{not json"))

	if r.Status != http.StatusAccepted {
		t.Fatalf("got %d %s, want 202", r.Status, r.Raw)
	}
}

func TestReplanWithoutAHomeIsNoHome(t *testing.T) {
	fake := replan.NewFake()
	app := apitest.Start(t, apitest.WithReplanner(fake))
	c := app.SignInAs("nohome@example.com")

	r := c.Post("/dev/replan", nil)

	if r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Fatalf("got %d %s, want 404 no home", r.Status, r.Raw)
	}
	if len(fake.Homes()) != 0 {
		t.Fatal("a caller without a Home reached the replanner")
	}
}

func TestReplanFailureIsNotA202AndLeaksNothing(t *testing.T) {
	fake := replan.NewFake()
	fake.FailWith(errors.New("boom secret-detail"))
	app := apitest.Start(t, apitest.WithReplanner(fake))
	c := apitest.HomeWithResident(t, app, "ana@example.com")

	r := c.Post("/dev/replan", nil)

	if r.Status != http.StatusBadGateway {
		t.Fatalf("got %d %s, want 502", r.Status, r.Raw)
	}
	if strings.Contains(string(r.Raw), "secret-detail") {
		t.Fatalf("the error text leaked to the client: %s", r.Raw)
	}
	if !app.Logs.Contains(homeID(t, c)) || !app.Logs.Contains("secret-detail") {
		t.Fatalf("the failure should be logged with the Home id and error: %s", app.Logs)
	}
}
