package admin_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// overview asks GET /admin/overview?range=rng as the super admin and decodes it.
func overview(t *testing.T, c *apitest.Client, rng string) admin.OverviewResponse {
	t.Helper()
	res := c.Get("/admin/overview?range=" + rng)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/overview?range=%s = %d %s", rng, res.Status, res.Raw)
	}
	var out admin.OverviewResponse
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestOverviewRejectsAnyOtherRange(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for _, path := range []string{
		"/admin/overview?range=90d", "/admin/overview?range=7D", "/admin/overview?range=",
		"/admin/overview", // a missing range is a 400, not a default of 7d
	} {
		res := su.Get(path)
		if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid range" {
			t.Errorf("GET %s = %d %s, want 400 invalid range", path, res.Status, res.Raw)
		}
	}
}

func TestOverviewCountsTotalsAndActiveHomesAndResidents(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t) // Home 1, five Chores, planned on Monday 2 March
	c := apitest.ExtraResident(t, app, a, "c@example.com")
	_ = c                                                  // never does anything: not active
	d := apitest.HomeWithResident(t, app, "d@example.com") // Home 2, no Chores

	one := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", one)   // a: Commitment
	apitest.MustAct(t, a, "complete", one) // a: Completion
	apitest.CheckIn(t, b, "normal")        // b: Check-in
	apitest.CheckIn(t, d, "low")           // d: Check-in, in the other Home
	su := app.SignInAsSuperAdmin("admin@example.com")

	got := overview(t, su, "7d")

	if want := (admin.Totals{Users: 4, Homes: 2, Residents: 4, Chores: 5}); got.Totals != want {
		t.Errorf("totals = %+v, want %+v (the super admin has no users row)", got.Totals, want)
	}
	if want := (admin.Active{Homes: 2, Residents: 3}); got.Active != want {
		t.Errorf("active = %+v, want %+v", got.Active, want)
	}
	if got.Range != "7d" || got.From != "2026-02-24" || got.To != "2026-03-02" || len(got.Days) != 7 {
		t.Errorf("range/from/to/days = %s %s %s %d", got.Range, got.From, got.To, len(got.Days))
	}
}

func TestOverviewActiveCountsOnlyTheRange(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	apitest.CheckIn(t, a, "normal") // on 2 March
	apitest.AtDay(app, 20)          // 18 days later
	su := app.SignInAsSuperAdmin("admin@example.com")

	if got := overview(t, su, "7d"); got.Active != (admin.Active{}) {
		t.Errorf("7d active = %+v, want none", got.Active)
	}
	if got := overview(t, su, "30d"); got.Active != (admin.Active{Homes: 1, Residents: 1}) {
		t.Errorf("30d active = %+v, want 1 Home and 1 Resident", got.Active)
	}
}

func TestOverviewReadCreatesNoUser(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	su := app.SignInAsSuperAdmin("admin@example.com")
	before := apitest.Count(t, app, `SELECT count(*) FROM users`)

	overview(t, su, "7d")

	if after := apitest.Count(t, app, `SELECT count(*) FROM users`); after != before {
		t.Fatalf("users rows = %d, want %d", after, before)
	}
}
