package admin_test

import (
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAIPreviousCoversTheNDaysBeforeTheWindowAndNothingElse(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	atNoonOn4March(app)
	for date, ms := range map[string]int{"2026-02-18": 1000, "2026-02-19": 100, "2026-02-25": 300, "2026-02-26": 500} {
		exec(t, app, `INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, latency_ms, input_tokens)
			VALUES ($1, $2::text::date, 'allocator', 'claude-haiku-5-5', 'accepted', $3, 10)`, app.Clock.Now(), date, ms)
	}

	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	p := got.Previous
	if p.From != "2026-02-19" || p.To != "2026-02-25" {
		t.Fatalf("previous = %s..%s, want 2026-02-19..2026-02-25", p.From, p.To)
	}
	a := p.Services.Allocator
	if a.Outcomes.Accepted != 2 || a.InputTokens != 20 {
		t.Errorf("previous allocator = %+v, want 2 accepted calls and 20 input tokens (18 and 26 Feb belong elsewhere)", a)
	}
	if a.LatencyP50Ms == nil || *a.LatencyP50Ms != 200 || a.LatencyMaxMs == nil || *a.LatencyMaxMs != 300 {
		t.Errorf("previous latency p50/max = %v/%v, want the range-level 200/300", a.LatencyP50Ms, a.LatencyMaxMs)
	}
	for _, day := range got.Days {
		want := 0
		if day.Date == "2026-02-26" {
			want = 1
		}
		if day.Services.Allocator.Outcomes.Accepted != want {
			t.Errorf("%s accepted = %d, want %d", day.Date, day.Services.Allocator.Outcomes.Accepted, want)
		}
	}
}

func TestAIPreviousOfAnEmptyWindowIsZerosWithNullLatency(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	got := aiAt(t, app.SignInAsSuperAdmin("admin@example.com"), "30d").Previous

	if got.From == "" || got.To == "" {
		t.Errorf("previous = %s..%s, want a window", got.From, got.To)
	}
	if !reflect.DeepEqual(got.Services, admin.AIServices{}) || got.AllocatorShare != (admin.AllocatorShare{}) ||
		got.ExplanationShare != (admin.ExplanationShare{}) {
		t.Errorf("previous = %+v, want all zeros and null latency", got)
	}
}

func TestAIPreviousEqualsTheCurrentTotalsOfNDaysEarlier(t *testing.T) {
	t.Parallel()
	app := llmWeek(t)
	su := app.SignInAsSuperAdmin("admin@example.com")
	thisWeek := aiAt(t, su, "7d")

	app.Clock.Set(app.Clock.Now().AddDate(0, 0, 7))
	next := aiAt(t, su, "7d")

	c, _ := llmalloc.Prices.Estimate(&haiku)
	f := func(v float64) *float64 { return &v }
	i := func(v int) *int { return &v }
	// Range-level figures, written by hand from the llmWeek fixture.
	want := admin.AIServices{
		Allocator: admin.ServiceDay{
			Outcomes: admin.Outcomes{Accepted: 1, RejectedByReferee: 1, Timeout: 1}, LatencyP50Ms: f(300), LatencyMaxMs: i(500),
			InputTokens: 2000, OutputTokens: 400, EstCostMicros: 2 * c, UncostedCalls: 1},
		Explainer: admin.ServiceDay{
			Outcomes: admin.Outcomes{Accepted: 2, SkippedCap: 1}, LatencyP50Ms: f(50), LatencyMaxMs: i(60),
			InputTokens: 1500, OutputTokens: 250, EstCostMicros: c, UncostedCalls: 1},
	}
	if !reflect.DeepEqual(next.Previous.Services, want) {
		t.Errorf("previous services = %+v\nwant %+v", next.Previous.Services, want)
	}
	if thisWeek.AllocatorShare.LLM+thisWeek.AllocatorShare.Baseline == 0 {
		t.Fatal("setup: the fixture week has no planned runs")
	}
	if next.Previous.AllocatorShare != thisWeek.AllocatorShare || next.Previous.ExplanationShare != thisWeek.ExplanationShare {
		t.Errorf("previous shares = %+v %+v, want %+v %+v", next.Previous.AllocatorShare, next.Previous.ExplanationShare,
			thisWeek.AllocatorShare, thisWeek.ExplanationShare)
	}
	if next.Previous.From != thisWeek.From || next.Previous.To != thisWeek.To {
		t.Errorf("previous = %s..%s, want %s..%s", next.Previous.From, next.Previous.To, thisWeek.From, thisWeek.To)
	}
}
