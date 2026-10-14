package dayplan_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// The harness Home is in UTC with the Allocation time at 07:00; atDay puts the
// fake clock at 09:00 UTC. 2 March 2026 is a Monday.

func checkIn(t *testing.T, c *apitest.Client, level string, restrictions ...string) apitest.Response {
	t.Helper()
	if restrictions == nil {
		restrictions = []string{}
	}
	r := c.Put("/home/check-in", map[string]any{"level": level, "restrictions": restrictions})
	if r.Status != http.StatusOK {
		t.Fatalf("PUT /home/check-in = %d %s", r.Status, r.Raw)
	}
	return r
}

func TestACheckInIsSavedAndReadBack(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 2)

	r := me.Get("/home/check-in")
	if r.Status != http.StatusOK || r.Body["checkedIn"] != false || r.Body["level"] != nil || r.Body["date"] != "2026-03-02" {
		t.Fatalf("before = %d %s", r.Status, r.Raw)
	}
	if rs, _ := r.Body["restrictions"].([]any); rs == nil || len(rs) != 0 {
		t.Fatalf("restrictions must be an empty array before a Check-in: %s", r.Raw)
	}

	put := checkIn(t, me, "low", "bending", "bending")
	get := me.Get("/home/check-in")
	for _, r := range []apitest.Response{put, get} {
		rs, _ := r.Body["restrictions"].([]any)
		if r.Body["checkedIn"] != true || r.Body["level"] != "low" || r.Body["date"] != "2026-03-02" || len(rs) != 1 || rs[0] != "bending" {
			t.Fatalf("body = %s", r.Raw)
		}
	}
}

func TestACheckInCanBeChangedAndReplacesItsRestrictions(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 2)

	checkIn(t, me, "low", "bending", "heights")
	r := checkIn(t, me, "energized")
	if rs, _ := r.Body["restrictions"].([]any); r.Body["level"] != "energized" || rs == nil || len(rs) != 0 {
		t.Fatalf("after change = %s", r.Raw)
	}
	if got := me.Get("/home/check-in"); got.Body["level"] != "energized" {
		t.Fatalf("GET = %s", got.Raw)
	}
}

func TestACheckInIsOnlyForTheDayItWasMadeOn(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 2)
	checkIn(t, me, "low", "bending")

	apitest.AtDay(app, 3)
	r := me.Get("/home/check-in")
	if r.Body["checkedIn"] != false || r.Body["level"] != nil || r.Body["date"] != "2026-03-03" {
		t.Fatalf("next day = %s", r.Raw)
	}
	if rs, _ := r.Body["restrictions"].([]any); len(rs) != 0 {
		t.Fatalf("a day Restriction carried over: %s", r.Raw)
	}
}

func TestACheckInBelongsToTheHomesLocalDateNotUTCs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("Pacific/Auckland", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	// 2 March 22:00 UTC is 3 March 11:00 in Auckland (UTC+13 in summer).
	app.Clock.Set(time.Date(2026, time.March, 2, 22, 0, 0, 0, time.UTC))
	r := checkIn(t, me, "low")
	if r.Body["date"] != "2026-03-03" {
		t.Fatalf("date = %v, want the Auckland date 2026-03-03", r.Body["date"])
	}
}

func TestACheckInNeedsAKnownLevelAndKnownDemands(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 2)

	for name, body := range map[string]any{
		"unknown level":   map[string]any{"level": "tired"},
		"missing level":   map[string]any{"restrictions": []string{"bending"}},
		"empty level":     map[string]any{"level": ""},
		"unknown demand":  map[string]any{"level": "low", "restrictions": []string{"flying"}},
		"unknown field":   map[string]any{"level": "low", "mood": "ok"},
		"wrong type":      map[string]any{"level": 3},
		"restrictions nn": map[string]any{"level": "low", "restrictions": "bending"},
	} {
		if r := me.Put("/home/check-in", body); r.Status != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, r.Status, r.Raw)
		}
	}
	if r := me.SendRaw(http.MethodPut, "/home/check-in", []byte(`{not json`)); r.Status != http.StatusBadRequest {
		t.Errorf("malformed JSON = %d, want 400", r.Status)
	}
	if r := me.Get("/home/check-in"); r.Body["checkedIn"] != false {
		t.Errorf("a rejected PUT saved something: %s", r.Raw)
	}
}

func TestACheckInNeedsAHomeAndAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	for _, method := range []string{http.MethodGet, http.MethodPut} {
		if r := app.SendRaw(method, "/home/check-in", []byte(`{"level":"low"}`)); r.Status != http.StatusUnauthorized {
			t.Errorf("%s with no token = %d, want 401", method, r.Status)
		}
	}
	nohome := app.SignInAs("nohome@example.com")
	if r := nohome.Get("/home/check-in"); r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Errorf("GET with no home = %d %s", r.Status, r.Raw)
	}
	if r := nohome.Put("/home/check-in", map[string]any{"level": "low"}); r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Errorf("PUT with no home = %d %s", r.Status, r.Raw)
	}
}

func TestACheckInIsPrivateToTheResidentAndTheirHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	other := apitest.HomeWithResident(t, app, "c@example.com")
	apitest.AtDay(app, 2)

	checkIn(t, a, "drained")
	for name, c := range map[string]*apitest.Client{"housemate": b, "other home": other} {
		if r := c.Get("/home/check-in"); r.Body["checkedIn"] != false {
			t.Errorf("%s sees A's Check-in: %s", name, r.Raw)
		}
	}
}

func TestDayRestrictionsNeverBecomeLastingOnes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 2)
	apitest.ExpectStatus(t, me.Put("/me/restrictions/heights", nil), http.StatusNoContent)
	before := string(me.Get("/me/profile").Raw)

	checkIn(t, me, "low", "bending", "heights") // heights duplicates a lasting one: no error
	if after := string(me.Get("/me/profile").Raw); after != before {
		t.Fatalf("profile changed by a Check-in:\nbefore %s\nafter  %s", before, after)
	}
}
