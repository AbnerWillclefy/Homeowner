package admin_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// Valid base64url key material, as PushSubscription.toJSON() emits.
const (
	testP256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
	testAuth   = "tBHItJI5svbpez7KI4CCXg"
)

// subscribe registers a device for the signed-in User and returns its endpoint.
func subscribe(t *testing.T, c *apitest.Client, name string) string {
	t.Helper()
	endpoint := "https://push.example.com/send/" + name
	r := c.Put("/push/subscription", map[string]any{
		"endpoint": endpoint, "keys": map[string]string{"p256dh": testP256dh, "auth": testAuth},
	})
	if r.Status >= 300 {
		t.Fatalf("PUT /push/subscription = %d %s", r.Status, r.Raw)
	}
	return endpoint
}

// overEnergy gives every Task to the first Resident, ignoring Energy, so the
// checker rejects the run of a Home with no Baseline.
type overEnergy struct{}

func (overEnergy) Name() string { return "stub" }

func (overEnergy) Plan(s allocation.State) (allocation.Result, error) {
	var res allocation.Result
	for _, tk := range s.Tasks {
		res.DayPlan.Assignments = append(res.DayPlan.Assignments,
			allocation.Assignment{TaskID: tk.ID, ResidentID: s.Residents[0].ID, Reason: allocation.ReasonFitsEnergy})
	}
	return res, nil
}

// soloHome is a Home of one Resident with one Chore, and Energy on Mondays
// when energy is above zero.
func soloHome(t *testing.T, app *apitest.App, email string, energy int) {
	t.Helper()
	c := apitest.HomeWithResident(t, app, email)
	if energy > 0 {
		apitest.SetBaseline(t, c, map[string]any{"monday": energy})
	}
	apitest.CreateChore(t, c, apitest.Chore("Solo", 7, 2, "normal", []string{}))
}

func TestOverviewCountsEveryEventOnItsOwnDay(t *testing.T) {
	t.Parallel()
	// Home 1: A and B plan on Monday 2 March (A: One, Two; B: Three, Four;
	// Five in the pool), and C has a device but no Energy.
	app := apitest.Start(t, apitest.WithPush("k"))
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	c := apitest.ExtraResident(t, app, a, "c@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	subscribe(t, a, "a")
	app.Push.AnswerError(subscribe(t, b, "b"))
	app.Push.AnswerGone(subscribe(t, c, "c"))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t) // pushes: A delivered, B failed, C gone

	refused := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "refuse", refused) // stays in the pool: 1 refuse
	var other string                         // the Task the plan left in the pool; which Chore it is does not matter
	for _, tk := range apitest.TaskList(t, apitest.DayPlan(t, b).Body["pool"]) {
		if tk["id"] != refused {
			other = tk["id"].(string)
		}
	}
	apitest.MustAct(t, b, "take", other) // 1 take
	mine, theirs := apitest.MineOf(t, a)[0]["id"].(string), apitest.MineOf(t, b)[0]["id"].(string)
	offer := a.Post("/home/swaps", map[string]any{"offeredTaskId": mine, "requestedTaskId": theirs})
	apitest.ExpectStatus(t, offer, http.StatusOK)
	swap := apitest.TaskList(t, apitest.DayPlan(t, b).Body["swaps"].(map[string]any)["incoming"])[0]["id"].(string)
	apitest.ExpectStatus(t, b.Post("/home/swaps/"+swap+"/accept", nil), http.StatusOK) // 1 swap
	apitest.MustAct(t, a, "complete", theirs)                                          // 1 completion

	// Home 2: the checker rejects the stub's plan. Home 3: the LLM fails, so
	// the baseline plans with a fallback reason.
	app.UseAllocator(overEnergy{})
	soloHome(t, app, "d@example.com", 0)
	app.RunAllocation(t)
	app.UseAllocator(allocation.Baseline{})
	fake := llmalloc.NewFakeClient()
	fake.Fail(errors.New("503 overloaded"))
	app.UseLLM(llmalloc.New(fake), 3, time.Second)
	soloHome(t, app, "e@example.com", 4)
	app.RunAllocation(t)

	// A nudge from before the outcome column, the day before.
	if _, err := app.DB.Exec(context.Background(), `INSERT INTO nudges (resident_id, kind, local_date, sent_at)
		SELECT id, 'checkin_reminder', '2026-03-01', now() FROM residents LIMIT 1`); err != nil {
		t.Fatal(err)
	}
	// A Check-in the next day.
	apitest.AtDay(app, 3)
	apitest.CheckIn(t, a, "normal")

	got := overview(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	want := map[string]admin.DayCounts{
		"2026-03-01": {Pushes: admin.Pushes{Unknown: 1}},
		"2026-03-02": {Runs: 3, Rejected: 1, Fallbacks: 1, Completions: 1, Refuses: 1, Takes: 1, SwapsAccepted: 1,
			Pushes: admin.Pushes{Delivered: 1, Failed: 1, Gone: 1}},
		"2026-03-03": {Checkins: 1},
	}
	if len(got.Days) != 7 || got.From != "2026-02-25" || got.To != "2026-03-03" {
		t.Fatalf("days = %d, from %s, to %s", len(got.Days), got.From, got.To)
	}
	for _, day := range got.Days {
		w := want[day.Date]
		if day.DayCounts != w {
			t.Errorf("%s = %+v, want %+v", day.Date, day.DayCounts, w)
		}
	}
}
