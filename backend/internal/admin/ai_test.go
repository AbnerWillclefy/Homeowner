package admin_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// aiAt asks GET /admin/ai?range=rng as the super admin and decodes it.
func aiAt(t *testing.T, c *apitest.Client, rng string) admin.AIResponse {
	t.Helper()
	res := c.Get("/admin/ai?range=" + rng)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/ai?range=%s = %d %s", rng, res.Status, res.Raw)
	}
	var out admin.AIResponse
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// proposer is a dayplan.Proposer whose answer a test scripts, so a run can be
// accepted, refused by the referee or time out without building a plan by hand.
type proposer func(allocation.State) (llmalloc.Proposal, error)

func (proposer) Name() string { return "llm" }

func (p proposer) Propose(_ context.Context, st allocation.State) (llmalloc.Proposal, error) {
	return p(st)
}

var haiku = llmalloc.Usage{Model: "claude-haiku-5-5", InputTokens: 1000, OutputTokens: 200}

// goodPlan proposes what the baseline would, which the referee accepts.
func goodPlan(st allocation.State) (llmalloc.Proposal, error) {
	res, err := allocation.Baseline{}.Plan(st)
	u := haiku
	return llmalloc.Proposal{Result: res, Usage: &u, Called: true}, err
}

// everythingToOne gives every Task to the first Resident, which the referee
// refuses for exceeding their Energy.
func everythingToOne(st allocation.State) (llmalloc.Proposal, error) {
	res, err := overEnergy{}.Plan(st)
	u := haiku
	return llmalloc.Proposal{Result: res, Usage: &u, Called: true}, err
}

// timesOut is a call that ran out of time and reported no usage.
func timesOut(allocation.State) (llmalloc.Proposal, error) {
	return llmalloc.Proposal{Called: true}, context.DeadlineExceeded
}

func explainerAnswer(items ...string) string {
	return `{"explanations": [` + strings.Join(items, ",") + `]}`
}

func explainerItem(id, text string) string {
	b, _ := json.Marshal(map[string]string{
		"resident_id": id, "headline_en_US": text, "headline_pt_BR": "pt " + text,
		"detail_en_US": "Detail " + text, "detail_pt_BR": "pt detail " + text,
	})
	return string(b)
}

func residentOf(t *testing.T, app *apitest.App, email string) string {
	t.Helper()
	var id string
	err := app.DB.QueryRow(context.Background(),
		`SELECT r.id FROM residents r JOIN users u ON u.id = r.user_id WHERE u.email = $1`, email).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// llmWeek plans one Home of two Residents on 2, 3 and 4 March 2026 through the
// real Allocation job, with the LLM allocator and explainer faked:
//
//	day 1: allocator accepted; explainer accepted for both Residents
//	day 2: allocator refused by the referee (the baseline plans); explainer
//	       accepted for one Resident of two, and reports a model with no price
//	day 3: allocator times out (the baseline plans); explainer skipped by the cap
//
// It returns the app with the clock at 09:00 UTC on 4 March.
func llmWeek(t *testing.T, opts ...apitest.Option) *apitest.App {
	t.Helper()
	app := apitest.Start(t, opts...)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetBaseline(t, c, map[string]any{"monday": 4, "tuesday": 4, "wednesday": 4})
	}
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 1, 2, "normal", []string{}))
	}
	ra, rb := residentOf(t, app, "a@example.com"), residentOf(t, app, "b@example.com")
	expl := llmalloc.NewFakeClient()
	app.UseLLM(proposer(goodPlan), 3, time.Second)
	app.UseExplainer(llmalloc.NewExplainer(expl), 0)

	app.Clock.Set(apitest.MondayAt(7))
	expl.Answer(explainerAnswer(explainerItem(ra, "Alpha"), explainerItem(rb, "Bravo")))
	app.RunAllocation(t)

	apitest.AtDay(app, 3)
	app.UseLLM(proposer(everythingToOne), 3, time.Second)
	expl.Answer(explainerAnswer(explainerItem(ra, "Alpha"), explainerItem(rb, ""))) // one summary invalid
	expl.ReportUsage("mystery", 500, 50)
	app.RunAllocation(t)

	apitest.AtDay(app, 4)
	app.UseLLM(proposer(timesOut), 1, time.Second) // the allocator takes the only slot
	app.RunAllocation(t)

	// The elapsed time of a call is real time, so pin it: one latency per
	// service and day.
	for date, ms := range map[string][2]int{"2026-03-02": {100, 40}, "2026-03-03": {300, 60}, "2026-03-04": {500, 0}} {
		for i, service := range []string{"allocator", "explainer"} {
			if _, err := app.DB.Exec(context.Background(),
				`UPDATE llm_call_events SET latency_ms = $3 WHERE local_date = $1::text::date AND service = $2 AND latency_ms IS NOT NULL`,
				date, service, ms[i]); err != nil {
				t.Fatal(err)
			}
		}
	}
	return app
}

func TestAIReportsCallsLatencyTokensAndCostPerDayAndService(t *testing.T) {
	t.Parallel()
	app := llmWeek(t)
	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	c, ok := llmalloc.Prices.Estimate(&haiku)
	if !ok || c <= 0 {
		t.Fatalf("setup: haiku estimate = %d %v", c, ok)
	}
	f := func(v float64) *float64 { return &v }
	i := func(v int) *int { return &v }
	want := map[string]admin.AIServices{
		"2026-03-02": {
			Allocator: admin.ServiceDay{Outcomes: admin.Outcomes{Accepted: 1}, LatencyP50Ms: f(100), LatencyMaxMs: i(100),
				InputTokens: 1000, OutputTokens: 200, EstCostMicros: c},
			Explainer: admin.ServiceDay{Outcomes: admin.Outcomes{Accepted: 1}, LatencyP50Ms: f(40), LatencyMaxMs: i(40),
				InputTokens: 1000, OutputTokens: 200, EstCostMicros: c},
		},
		"2026-03-03": {
			Allocator: admin.ServiceDay{Outcomes: admin.Outcomes{RejectedByReferee: 1}, LatencyP50Ms: f(300), LatencyMaxMs: i(300),
				InputTokens: 1000, OutputTokens: 200, EstCostMicros: c},
			// The unknown model: tokens are summed, the cost is not, and the call is counted apart.
			Explainer: admin.ServiceDay{Outcomes: admin.Outcomes{Accepted: 1}, LatencyP50Ms: f(60), LatencyMaxMs: i(60),
				InputTokens: 500, OutputTokens: 50, UncostedCalls: 1},
		},
		"2026-03-04": {
			// A call that timed out was made but has no usage, so no cost.
			Allocator: admin.ServiceDay{Outcomes: admin.Outcomes{Timeout: 1}, LatencyP50Ms: f(500), LatencyMaxMs: i(500), UncostedCalls: 1},
			// A skip is not a call: no latency, nothing uncosted.
			Explainer: admin.ServiceDay{Outcomes: admin.Outcomes{SkippedCap: 1}},
		},
	}
	if got.Range != "7d" || got.From != "2026-02-26" || got.To != "2026-03-04" || len(got.Days) != 7 || !got.CostIsEstimate {
		t.Fatalf("range/from/to/days/costIsEstimate = %s %s %s %d %v", got.Range, got.From, got.To, len(got.Days), got.CostIsEstimate)
	}
	for _, day := range got.Days {
		w := want[day.Date] // a day with no events is all zero and null
		if !reflect.DeepEqual(day.Services, w) {
			t.Errorf("%s = %+v\nwant %+v", day.Date, day.Services, w)
		}
	}
}

func TestAIMedianAndMaxCoverEveryCallOfTheDayAndIgnoreSkips(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	for _, row := range []struct {
		outcome string
		latency any
	}{{"accepted", 100}, {"accepted", 200}, {"accepted", 300}, {"error", 400}, {"skipped_cap", nil}, {"skipped_budget", nil}} {
		if _, err := app.DB.Exec(context.Background(), `
			INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, latency_ms)
			VALUES ($1, '2026-03-04', 'allocator', 'claude-haiku-5-5', $2, $3)`,
			app.Clock.Now(), row.outcome, row.latency); err != nil {
			t.Fatal(err)
		}
	}
	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	a := got.Days[len(got.Days)-1].Services.Allocator
	if a.LatencyP50Ms == nil || *a.LatencyP50Ms != 250 || a.LatencyMaxMs == nil || *a.LatencyMaxMs != 400 {
		t.Errorf("p50/max = %v/%v, want 250/400 over the four calls", a.LatencyP50Ms, a.LatencyMaxMs)
	}
	if a.Outcomes != (admin.Outcomes{Accepted: 3, Error: 1, SkippedCap: 1, SkippedBudget: 1}) {
		t.Errorf("outcomes = %+v", a.Outcomes)
	}
	if e := got.Days[len(got.Days)-1].Services.Explainer; e.LatencyP50Ms != nil || e.LatencyMaxMs != nil {
		t.Errorf("explainer latency = %v/%v on a day with no calls, want null", e.LatencyP50Ms, e.LatencyMaxMs)
	}
}

func TestAIMonthToDateCostIsUTCCalendarMonthAndIndependentOfTheRange(t *testing.T) {
	t.Parallel()
	app := llmWeek(t, apitest.WithLLMDisplay(3, 10_000_000))
	// Last month's event: outside the month, and 37 days back from 4 March
	// is outside every range.
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, latency_ms, est_cost_micros)
		VALUES ('2026-02-28 23:59:59+00', '2026-02-28', 'allocator', 'claude-haiku-5-5', 'accepted', 10, 999)`); err != nil {
		t.Fatal(err)
	}
	c, _ := llmalloc.Prices.Estimate(&haiku)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for _, rng := range []string{"7d", "30d"} {
		got := aiAt(t, su, rng)
		// Three haiku calls cost c; the mystery model and the timeout are uncosted.
		want := admin.MonthToDate{Month: "2026-03", EstCostMicros: 3 * c, UncostedCalls: 2, LimitMicros: ptr(int64(10_000_000))}
		if got.MonthToDate.Month != want.Month || got.MonthToDate.EstCostMicros != want.EstCostMicros ||
			got.MonthToDate.UncostedCalls != want.UncostedCalls ||
			got.MonthToDate.LimitMicros == nil || *got.MonthToDate.LimitMicros != *want.LimitMicros {
			t.Errorf("%s monthToDate = %+v, want %+v", rng, got.MonthToDate, want)
		}
		if got.DailyCapPerHome != 3 {
			t.Errorf("dailyCapPerHome = %d, want 3", got.DailyCapPerHome)
		}
	}
}

func ptr[T any](v T) *T { return &v }

func TestAINoSpendLimitConfiguredIsNull(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=7d")
	if res.Status != http.StatusOK {
		t.Fatalf("status = %d %s", res.Status, res.Raw)
	}
	month := res.Body["monthToDate"].(map[string]any)
	if v, present := month["limitMicros"]; !present || v != nil {
		t.Errorf("limitMicros = %v (present %v), want null", v, present)
	}
}

func TestAISharesAndTemplateReasons(t *testing.T) {
	t.Parallel()
	app := llmWeek(t)
	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	// Day 1 was planned by the LLM; days 2 and 3 fell back to the baseline.
	if want := (admin.AllocatorShare{LLM: 1, Baseline: 2}); got.AllocatorShare != want {
		t.Errorf("allocatorShare = %+v, want %+v", got.AllocatorShare, want)
	}
	// Two Residents on three planned days is six explanations. The LLM wrote
	// three (2 + 1). Of the other three, two were never asked for (the cap
	// skipped day 3) and one was asked for but came back invalid (partial).
	wantReasons := map[string]int{
		"rejected_by_referee": 0, "invalid_response": 0, "timeout": 0, "error": 0,
		"skipped_cap": 2, "skipped_budget": 0, "partial": 1, "notAsked": 0,
	}
	e := got.ExplanationShare
	if e.LLM != 3 || e.Template != 3 || fmt.Sprint(e.TemplateReasons) != fmt.Sprint(wantReasons) {
		t.Errorf("explanationShare = %+v, want llm 3, template 3, reasons %v", e, wantReasons)
	}
}

func TestAIListsTheTopViolationKindsAndFallbackReasons(t *testing.T) {
	t.Parallel()
	app := llmWeek(t)
	// More history, to count across rows and to tie-break by name.
	for _, kinds := range []string{"{over_energy,broken_restriction}", "{broken_restriction}"} {
		if _, err := app.DB.Exec(context.Background(), `
			INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, violation_kinds, latency_ms)
			VALUES ($1, '2026-03-04', 'allocator', 'claude-haiku-5-5', 'rejected_by_referee', $2::text[], 5)`,
			app.Clock.Now(), kinds); err != nil {
			t.Fatal(err)
		}
	}
	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	// The refused plan of day 2 gave everything to one Resident (over_energy);
	// the two inserted rows add one over_energy and two broken_restriction.
	wantKinds := []admin.KindCount{{Kind: "broken_restriction", Count: 2}, {Kind: "over_energy", Count: 2}}
	if !slices.Equal(got.TopViolationKinds, wantKinds) {
		t.Errorf("topViolationKinds = %+v, want %+v", got.TopViolationKinds, wantKinds)
	}
	wantReasons := []admin.ReasonCount{{Reason: "llm_rejected_by_checker", Count: 1}, {Reason: "llm_timeout", Count: 1}}
	if !slices.Equal(got.TopFallbackReasons, wantReasons) {
		t.Errorf("topFallbackReasons = %+v, want %+v", got.TopFallbackReasons, wantReasons)
	}
}

func TestAIRejectsAnyOtherRange(t *testing.T) {
	t.Parallel()
	su := apitest.Start(t).SignInAsSuperAdmin("admin@example.com")
	for _, path := range []string{"/admin/ai", "/admin/ai?range=", "/admin/ai?range=90d"} {
		if res := su.Get(path); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid range" {
			t.Errorf("GET %s = %d %s, want 400 invalid range", path, res.Status, res.Raw)
		}
	}
}

func TestAIEmptyRangeHasZeroFilledDaysAndEmptyListsNotNull(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithLLMDisplay(3, 0))
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=30d")
	if res.Status != http.StatusOK {
		t.Fatalf("status = %d %s", res.Status, res.Raw)
	}
	for _, k := range []string{"topViolationKinds", "topFallbackReasons"} {
		if l, ok := res.Body[k].([]any); !ok || len(l) != 0 {
			t.Errorf("%s = %v, want []", k, res.Body[k])
		}
	}
	if days := res.Body["days"].([]any); len(days) != 30 {
		t.Errorf("days = %d, want 30", len(days))
	}
}

func TestAILeaksNoPersonalDataAndHasAKnownKeySet(t *testing.T) {
	t.Parallel()
	app := llmWeek(t, apitest.WithLLMDisplay(3, 10_000_000))
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=30d")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/ai = %d %s", res.Status, res.Raw)
	}
	var decoded any
	if err := json.Unmarshal(res.Raw, &decoded); err != nil {
		t.Fatal(err)
	}

	secrets := []string{"a@example.com", "b@example.com", "One", "Two", "Three", "Alpha", "Bravo"}
	forbidden := map[string]bool{"email": true, "name": true, "displayName": true, "userId": true, "user_id": true,
		"title": true, "choreName": true, "prompt": true, "text": true, "headline": true, "detail": true,
		"homeId": true, "residentId": true, "runId": true}
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

	// The whole key set is known, so a new field must be added here on purpose.
	keys := map[string]bool{}
	walk(decoded, func(k string) { keys[k] = true }, func(string) {})
	for _, k := range []string{"range", "from", "to", "costIsEstimate", "days", "date", "services", "allocator", "explainer",
		"outcomes", "accepted", "rejected_by_referee", "invalid_response", "timeout", "error", "skipped_cap", "skipped_budget",
		"latencyP50Ms", "latencyMaxMs", "inputTokens", "outputTokens", "estCostMicros", "uncostedCalls",
		"monthToDate", "month", "limitMicros", "dailyCapPerHome",
		"allocatorShare", "llm", "baseline",
		"explanationShare", "template", "templateReasons", "partial", "notAsked",
		"topViolationKinds", "kind", "count", "topFallbackReasons", "reason"} {
		if !keys[k] {
			t.Errorf("response lacks the key %q", k)
		}
		delete(keys, k)
	}
	if len(keys) != 0 {
		t.Errorf("response has unexpected keys %v", keys)
	}
}
