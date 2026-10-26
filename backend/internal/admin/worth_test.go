package admin_test

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// worthAt asks GET /admin/worth?range=rng as the super admin and decodes it.
func worthAt(t *testing.T, c *apitest.Client, rng string) admin.WorthResponse {
	t.Helper()
	res := c.Get("/admin/worth?range=" + rng)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/worth?range=%s = %d %s", rng, res.Status, res.Raw)
	}
	var out admin.WorthResponse
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// bothArms plans Monday 2 March 2026 for three Homes through the real
// Allocation job. The faked LLM plans for a Home of two Residents and times out
// for a Home of one:
//
//	Home A (two Residents, five Chores): the LLM plans four Tasks, one goes to
//	  the pool. A refuses one Task, B takes the pool Task, A completes another.
//	Home B (one Resident, two Chores): the LLM times out and the baseline plans
//	  both. B completes both, then one Completion is moved to the next day.
//	Home C (one Resident with no Energy): the LLM is never asked.
//
// The clock ends at 09:00 UTC on 2 March.
func bothArms(t *testing.T) *apitest.App {
	t.Helper()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	solo := apitest.HomeWithResident(t, app, "solo@example.com")
	apitest.SetBaseline(t, solo, map[string]any{"monday": 4})
	apitest.HomeWithResident(t, app, "idle@example.com")

	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	for _, n := range []string{"Sweep", "Mop"} {
		apitest.CreateChore(t, solo, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	apitest.CreateChore(t, app.SignInAs("idle@example.com"), apitest.Chore("Dust", 7, 2, "normal", []string{}))
	app.UseLLM(proposer(func(st allocation.State) (llmalloc.Proposal, error) {
		if len(st.Residents) > 1 {
			return goodPlan(st)
		}
		return timesOut(st)
	}), 3, time.Second)
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	app.Clock.Set(apitest.MondayAt(9))

	refused := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "refuse", refused)
	var pooled string
	for _, tk := range apitest.TaskList(t, apitest.DayPlan(t, b).Body["pool"]) {
		if tk["id"] != refused {
			pooled = tk["id"].(string)
		}
	}
	apitest.MustAct(t, b, "take", pooled)
	apitest.MustAct(t, a, "complete", apitest.MineOf(t, a)[0]["id"].(string))

	mine := apitest.MineOf(t, solo)
	if len(mine) != 2 {
		t.Fatalf("setup: solo has %d Tasks", len(mine))
	}
	for _, tk := range mine {
		apitest.MustAct(t, solo, "complete", tk["id"].(string))
	}
	if _, err := app.DB.Exec(context.Background(),
		`UPDATE completions SET completed_on = '2026-03-03' WHERE task_id = $1`, mine[1]["id"]); err != nil {
		t.Fatal(err)
	}
	return app
}

func TestWorthCountsOutcomePerArm(t *testing.T) {
	t.Parallel()
	app := bothArms(t)

	got := worthAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	// LLM arm: four proposed Tasks (the one taken from the pool is not one, the
	// refused one is), one completed on the day, one refused. Baseline arm: two
	// proposed, one completed on the plan date and one on the next day, which
	// does not count. Home C's plan proposes nothing.
	want := admin.WorthOutcome{
		LLM:      admin.ArmOutcome{Proposed: 4, Completed: 1, Refused: 1},
		Baseline: admin.ArmOutcome{Proposed: 2, Completed: 1, Refused: 0},
	}
	if got.Current.Outcome != want {
		t.Errorf("current outcome = %+v, want %+v", got.Current.Outcome, want)
	}
	if got.Range != "7d" || got.From != "2026-02-24" || got.To != "2026-03-02" || !got.CostIsEstimate {
		t.Errorf("range/from/to/costIsEstimate = %s %s %s %v", got.Range, got.From, got.To, got.CostIsEstimate)
	}
}

func TestWorthCountsReliabilityCostAndExplanations(t *testing.T) {
	t.Parallel()
	app := bothArms(t)

	got := worthAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	// One run planned by the LLM, one that fell back after the model timed out,
	// one where the LLM was not asked. Two calls were made.
	wantRel := admin.WorthReliability{RunsLLM: 1, RunsFallback: 1, RunsLLMNotAsked: 1, AllocatorCalls: 2}
	if got.Current.Reliability != wantRel {
		t.Errorf("reliability = %+v, want %+v", got.Current.Reliability, wantRel)
	}
	// The accepted call is costed; the timeout reported no usage.
	c, ok := llmalloc.Prices.Estimate(&haiku)
	if !ok || c <= 0 {
		t.Fatalf("setup: haiku estimate = %d %v", c, ok)
	}
	if want := (admin.WorthCost{AllocatorCostMicros: c, UncostedCalls: 1}); got.Current.Cost != want {
		t.Errorf("cost = %+v, want %+v", got.Current.Cost, want)
	}
	// No explainer is configured: every Resident holding an assignment is on the template.
	if want := (admin.WorthExplanations{Template: 3}); got.Current.Explanations != want {
		t.Errorf("explanations = %+v, want %+v", got.Current.Explanations, want)
	}
	if got.Previous.From != "2026-02-17" || got.Previous.To != "2026-02-23" || !reflect.DeepEqual(got.Previous.WorthCounts, admin.WorthCounts{}) {
		t.Errorf("previous = %+v, want 17..23 Feb and empty", got.Previous)
	}
}

func TestWorthPartitionsRunsLikeTheOverview(t *testing.T) {
	t.Parallel()
	app := bothArms(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	w := worthAt(t, su, "7d").Current.Reliability
	var runs int
	for _, d := range overview(t, su, "7d").Days {
		runs += d.Runs
	}

	if w.RunsLLM+w.RunsFallback+w.RunsLLMNotAsked != runs {
		t.Errorf("runsLlm+runsFallback+runsLlmNotAsked = %+v, overview runs = %d", w, runs)
	}
}

func TestWorthCostIncludesFallbackCallsAndExcludesTheExplainer(t *testing.T) {
	t.Parallel()
	app := llmWeek(t) // day 2: the referee refuses a costed allocator call; the explainer is costed too
	su := app.SignInAsSuperAdmin("admin@example.com")

	got := worthAt(t, su, "7d").Current.Cost

	c, _ := llmalloc.Prices.Estimate(&haiku)
	// Accepted (day 1) plus rejected by the referee (day 2): two costed
	// allocator calls. The day-3 timeout has no usage. Explainer rows, which
	// also carry a cost, are left out.
	if want := (admin.WorthCost{AllocatorCostMicros: 2 * c, UncostedCalls: 1}); got != want {
		t.Errorf("cost = %+v, want %+v", got, want)
	}
}

func TestWorthAgreesWithOverviewFlowAndAIForTheSameRange(t *testing.T) {
	t.Parallel()
	app := llmWeek(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for _, rng := range []string{"7d", "30d"} {
		w := worthAt(t, su, rng)
		ai := aiAt(t, su, rng)
		flow := counts(t, flowAt(t, su, rng))

		var cost int64
		for _, d := range ai.Days {
			cost += d.Services.Allocator.EstCostMicros
		}
		if w.Current.Reliability.RunsLLM != ai.AllocatorShare.LLM {
			t.Errorf("%s runsLlm = %d, ai allocatorShare.llm = %d", rng, w.Current.Reliability.RunsLLM, ai.AllocatorShare.LLM)
		}
		if w.Current.Explanations.LLM != ai.ExplanationShare.LLM || w.Current.Explanations.Template != ai.ExplanationShare.Template {
			t.Errorf("%s explanations = %+v, ai %+v", rng, w.Current.Explanations, ai.ExplanationShare)
		}
		if w.Current.Cost.AllocatorCostMicros != cost {
			t.Errorf("%s allocator cost = %d, ai days sum to %d", rng, w.Current.Cost.AllocatorCostMicros, cost)
		}
		if w.Current.Reliability.AllocatorCalls != flow["llmAsked"] {
			t.Errorf("%s allocatorCalls = %d, flow llmAsked = %d", rng, w.Current.Reliability.AllocatorCalls, flow["llmAsked"])
		}
		if !reflect.DeepEqual(w.MonthToDate, ai.MonthToDate) {
			t.Errorf("%s monthToDate = %+v, ai %+v", rng, w.MonthToDate, ai.MonthToDate)
		}
	}
}

func TestWorthMonthToDateShowsTheConfiguredLimit(t *testing.T) {
	t.Parallel()
	app := llmWeek(t, apitest.WithLLMDisplay(3, 10_000_000))
	su := app.SignInAsSuperAdmin("admin@example.com")

	w, ai := worthAt(t, su, "7d"), aiAt(t, su, "7d")

	if w.MonthToDate.LimitMicros == nil || *w.MonthToDate.LimitMicros != 10_000_000 || !reflect.DeepEqual(w.MonthToDate, ai.MonthToDate) {
		t.Errorf("monthToDate = %+v, ai %+v", w.MonthToDate, ai.MonthToDate)
	}
}

// seedRun inserts an LLM-planned run of the Home on a date, and an accepted
// allocator call of 100 micro-USD on the same date.
func seedRun(t *testing.T, app *apitest.App, date string) {
	t.Helper()
	ctx := context.Background()
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO allocation_runs (home_id, plan_date, allocator, outcome, created_at)
		SELECT id, $1::text::date, 'llm', 'planned', now() FROM homes LIMIT 1`, date); err != nil {
		t.Fatal(err)
	}
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, latency_ms, est_cost_micros)
		VALUES (now(), $1::text::date, 'allocator', 'claude-haiku-5-5', 'accepted', 10, 100)`, date); err != nil {
		t.Fatal(err)
	}
}

func TestWorthPreviousIsExactlyTheNDaysBeforeTheWindow(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.HomeWithResident(t, app, "a@example.com")
	// The clock is 4 March 2026: the 7d window is 26 Feb..4 Mar and the
	// previous one 19..25 Feb. A row on each side of both boundaries.
	for _, d := range []string{"2026-02-18", "2026-02-19", "2026-02-25", "2026-02-26", "2026-03-04"} {
		// UNIQUE (home_id, plan_date) holds: one run per date.
		seedRun(t, app, d)
	}

	got := worthAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	if got.Previous.From != "2026-02-19" || got.Previous.To != "2026-02-25" {
		t.Errorf("previous = %s..%s", got.Previous.From, got.Previous.To)
	}
	if r := got.Previous.Reliability; r.RunsLLM != 2 || r.AllocatorCalls != 2 || got.Previous.Cost.AllocatorCostMicros != 200 {
		t.Errorf("previous = %+v %+v, want 2 runs and 2 calls (19 and 25 Feb), 18 Feb left out", r, got.Previous.Cost)
	}
	if r := got.Current.Reliability; r.RunsLLM != 2 || r.AllocatorCalls != 2 || got.Current.Cost.AllocatorCostMicros != 200 {
		t.Errorf("current = %+v %+v, want 2 runs and 2 calls (26 Feb and 4 Mar)", r, got.Current.Cost)
	}
}

func TestWorthDaysAreZeroFilledAndAddUpToCurrent(t *testing.T) {
	t.Parallel()
	app := bothArms(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for rng, n := range map[string]int{"7d": 7, "30d": 30} {
		got := worthAt(t, su, rng)
		if len(got.Days) != n || got.Days[n-1].Date != got.To || got.Days[0].Date != got.From {
			t.Fatalf("%s days = %d, %s..%s", rng, len(got.Days), got.Days[0].Date, got.Days[len(got.Days)-1].Date)
		}
		var sum admin.WorthCounts
		for _, d := range got.Days {
			if d.Date != "2026-03-02" && !reflect.DeepEqual(d.WorthCounts, admin.WorthCounts{}) {
				t.Errorf("%s %s = %+v, want zeros", rng, d.Date, d.WorthCounts)
			}
			sum = addWorth(sum, d.WorthCounts)
		}
		if !reflect.DeepEqual(sum, got.Current) {
			t.Errorf("%s days add up to %+v, current is %+v", rng, sum, got.Current)
		}
	}
}

func addWorth(a, b admin.WorthCounts) admin.WorthCounts {
	a.Outcome.LLM.Proposed += b.Outcome.LLM.Proposed
	a.Outcome.LLM.Completed += b.Outcome.LLM.Completed
	a.Outcome.LLM.Refused += b.Outcome.LLM.Refused
	a.Outcome.Baseline.Proposed += b.Outcome.Baseline.Proposed
	a.Outcome.Baseline.Completed += b.Outcome.Baseline.Completed
	a.Outcome.Baseline.Refused += b.Outcome.Baseline.Refused
	a.Reliability.RunsLLM += b.Reliability.RunsLLM
	a.Reliability.RunsFallback += b.Reliability.RunsFallback
	a.Reliability.RunsLLMNotAsked += b.Reliability.RunsLLMNotAsked
	a.Reliability.AllocatorCalls += b.Reliability.AllocatorCalls
	a.Reliability.RefereeRejected += b.Reliability.RefereeRejected
	a.Cost.AllocatorCostMicros += b.Cost.AllocatorCostMicros
	a.Cost.UncostedCalls += b.Cost.UncostedCalls
	a.Explanations.LLM += b.Explanations.LLM
	a.Explanations.Template += b.Explanations.Template
	return a
}

func TestWorthOfAnEmptyRangeIsAllZeros(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	got := worthAt(t, app.SignInAsSuperAdmin("admin@example.com"), "30d")

	if len(got.Days) != 30 || !reflect.DeepEqual(got.Current, admin.WorthCounts{}) || !reflect.DeepEqual(got.Previous.WorthCounts, admin.WorthCounts{}) {
		t.Errorf("current/previous/days = %+v / %+v / %d", got.Current, got.Previous, len(got.Days))
	}
	for _, d := range got.Days {
		if !reflect.DeepEqual(d.WorthCounts, admin.WorthCounts{}) {
			t.Errorf("%s = %+v", d.Date, d.WorthCounts)
		}
	}
}

func TestWorthCountsOnlyThePlannedRunsTasksOnce(t *testing.T) {
	t.Parallel()
	// A two-person Task has two assignment rows in one run: one proposed Task.
	app, _, _ := apitest.DuoHome(t, 4, 4)

	got := worthAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	if p := got.Current.Outcome.Baseline.Proposed; p != 1 {
		t.Errorf("baseline proposed = %d, want 1 for one two-person Task", p)
	}
}

func TestWorthRejectsAnyOtherRange(t *testing.T) {
	t.Parallel()
	su := apitest.Start(t).SignInAsSuperAdmin("admin@example.com")
	for _, path := range []string{"/admin/worth", "/admin/worth?range=", "/admin/worth?range=90d"} {
		if res := su.Get(path); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid range" {
			t.Errorf("GET %s = %d %s, want 400 invalid range", path, res.Status, res.Raw)
		}
	}
}

func TestWorthRefusesEveryMethodButGet(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for _, m := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		// The admin mux has a catch-all "/", so a method no pattern names falls
		// through to its 404 rather than a 405. Either way the route does not run.
		if res := su.Do(m, "/admin/worth?range=7d", nil, nil); res.Status != http.StatusNotFound {
			t.Errorf("%s /admin/worth = %d %s, want 404", m, res.Status, res.Raw)
		}
	}
}

func TestWorthLeaksNoPersonalDataAndHasAKnownKeySet(t *testing.T) {
	t.Parallel()
	app := bothArms(t)
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/worth?range=30d")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/worth = %d %s", res.Status, res.Raw)
	}
	var decoded any
	if err := json.Unmarshal(res.Raw, &decoded); err != nil {
		t.Fatal(err)
	}
	secrets := []string{"a@example.com", "b@example.com", "solo@example.com", "idle@example.com",
		"One", "Two", "Three", "Four", "Five", "Sweep", "Mop", "Dust"}
	forbidden := map[string]bool{"email": true, "name": true, "displayName": true, "userId": true, "user_id": true,
		"title": true, "choreName": true, "homeId": true, "residentId": true, "runId": true, "taskId": true, "id": true}
	walk(decoded, func(k string) {
		if forbidden[k] {
			t.Errorf("response has the key %q: %s", k, res.Raw)
		}
	}, func(s string) {
		for _, secret := range secrets {
			if strings.EqualFold(s, secret) || strings.Contains(s, "@") {
				t.Errorf("response has the value %q", s)
			}
		}
	})

	keys := map[string]bool{}
	walk(decoded, func(k string) { keys[k] = true }, func(string) {})
	for _, k := range []string{"range", "from", "to", "costIsEstimate", "current", "previous", "days", "date",
		"monthToDate", "month", "estCostMicros", "uncostedCalls", "limitMicros",
		"outcome", "llm", "baseline", "proposed", "completed", "refused",
		"reliability", "runsLlm", "runsFallback", "runsLlmNotAsked", "allocatorCalls", "refereeRejected",
		"cost", "allocatorCostMicros", "explanations", "template"} {
		if !keys[k] {
			t.Errorf("response lacks the key %q", k)
		}
		delete(keys, k)
	}
	if len(keys) != 0 {
		t.Errorf("response has unexpected keys %v", keys)
	}
}
