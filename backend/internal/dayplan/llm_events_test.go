package dayplan_test

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// event is one llm_call_events row as the tests read it.
type event struct {
	homeID, runID                        *string
	localDate                            time.Time
	service, model, outcome              string
	violationKinds                       []string
	latencyMs, inputTokens, outputTokens *int32
	estCostMicros                        *int64
}

func events(t *testing.T, app *apitest.App) []event {
	t.Helper()
	rows, err := app.DB.Query(context.Background(), `
		SELECT home_id, run_id, local_date, service, model, outcome, violation_kinds,
		       latency_ms, input_tokens, output_tokens, est_cost_micros
		FROM llm_call_events ORDER BY created_at, id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []event
	for rows.Next() {
		var e event
		if err := rows.Scan(&e.homeID, &e.runID, &e.localDate, &e.service, &e.model, &e.outcome, &e.violationKinds,
			&e.latencyMs, &e.inputTokens, &e.outputTokens, &e.estCostMicros); err != nil {
			t.Fatal(err)
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func theEvent(t *testing.T, app *apitest.App) event {
	t.Helper()
	es := events(t, app)
	if len(es) != 1 {
		t.Fatalf("%d llm_call_events rows, want 1: %+v", len(es), es)
	}
	return es[0]
}

func TestAnAcceptedProposalIsRecorded(t *testing.T) {
	t.Parallel()
	app, a, fake, st := llmHome(t)
	ra, rb := st.Residents[0], st.Residents[1]
	fake.Answer(answer(give(task(st, 1, 0), rb), give(task(st, 2, 0), ra), give(task(st, 2, 0), rb)))

	app.RunAllocation(t)
	e := theEvent(t, app)
	if e.outcome != "accepted" || e.service != "allocator" || len(e.violationKinds) != 0 {
		t.Fatalf("event = %+v", e)
	}
	// Row contents.
	var runID string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM allocation_runs`).Scan(&runID); err != nil {
		t.Fatal(err)
	}
	if e.homeID == nil || *e.homeID != homeIDOf(t, a) || e.runID == nil || *e.runID != runID {
		t.Errorf("home/run = %v/%v, want %s/%s", e.homeID, e.runID, homeIDOf(t, a), runID)
	}
	if !e.localDate.Equal(st.Today.Time()) {
		t.Errorf("local_date = %v, want %v", e.localDate, st.Today.Time())
	}
	if e.model != "claude-haiku-5-5" || e.latencyMs == nil || e.inputTokens == nil || *e.inputTokens != 1000 ||
		e.outputTokens == nil || *e.outputTokens != 200 || e.estCostMicros == nil || *e.estCostMicros <= 0 {
		t.Errorf("event = %+v, want the default model, latency, tokens and a cost", e)
	}
}

func TestARefusedProposalIsRecordedWithItsViolationKinds(t *testing.T) {
	t.Parallel()
	app, _, fake, st := llmHome(t)
	r := st.Residents[0]
	fake.Answer(answer(give(task(st, 1, 0), r), give(task(st, 1, 1), r), give(task(st, 1, 2), r)))

	app.RunAllocation(t)
	e := theEvent(t, app)
	if e.outcome != "rejected_by_referee" || e.runID == nil || len(e.violationKinds) == 0 {
		t.Fatalf("event = %+v", e)
	}
	if !slices.IsSorted(e.violationKinds) || len(slices.Compact(slices.Clone(e.violationKinds))) != len(e.violationKinds) {
		t.Errorf("violation_kinds = %v, want distinct and sorted", e.violationKinds)
	}
	vs := allocation.Check(allocation.DayPlan{Assignments: []allocation.Assignment{
		give(task(st, 1, 0), r), give(task(st, 1, 1), r), give(task(st, 1, 2), r)}}, st)
	if len(vs) == 0 || !slices.Contains(e.violationKinds, string(vs[0].Kind)) {
		t.Errorf("violation_kinds = %v, want it to hold %v", e.violationKinds, vs)
	}
}

func TestEachFailedCallIsRecordedWithItsOutcome(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		set        func(*llmalloc.FakeClient)
		want       string
		wantTokens bool
	}{
		"invalid response": {func(f *llmalloc.FakeClient) { f.Answer(`not json`) }, "invalid_response", true},
		"timeout":          {func(f *llmalloc.FakeClient) { f.Block() }, "timeout", false},
		"error":            {func(f *llmalloc.FakeClient) { f.Fail(errors.New("boom")) }, "error", false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, _, fake, _ := llmHome(t)
			app.UseLLM(llmalloc.New(fake), llmDailyCap, 50*time.Millisecond)
			tc.set(fake)

			app.RunAllocation(t)
			e := theEvent(t, app)
			if e.outcome != tc.want || e.runID == nil || e.latencyMs == nil {
				t.Fatalf("event = %+v, want %s with a run and a latency", e, tc.want)
			}
			if got := e.inputTokens != nil && e.outputTokens != nil; got != tc.wantTokens {
				t.Errorf("tokens filled = %v, want %v", got, tc.wantTokens)
			}
			if !tc.wantTokens && e.estCostMicros != nil {
				t.Errorf("est_cost_micros = %d without usage, want null", *e.estCostMicros)
			}
		})
	}
}

func TestAReplanOverTheCapIsRecordedAsSkippedCap(t *testing.T) {
	t.Parallel()
	app, a, _, _ := llmHome(t)
	app.UseLLM(llmalloc.New(llmalloc.NewFakeClient()), 1, time.Second)

	app.RunAllocation(t)
	if _, err := app.Planner.ReplanHome(context.Background(), homeIDOf(t, a), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	es := events(t, app)
	// Both rows share the fake clock's created_at, so find the skipped one.
	i := slices.IndexFunc(es, func(e event) bool { return e.outcome == "skipped_cap" })
	if len(es) != 2 || i < 0 || es[1-i].outcome != "accepted" {
		t.Fatalf("events = %+v, want a call then skipped_cap", es)
	}
	if e := es[i]; e.latencyMs != nil || e.inputTokens != nil || e.outputTokens != nil || e.estCostMicros != nil || e.runID == nil {
		t.Errorf("skipped event = %+v, want no latency, tokens or cost, but a run", e)
	}
}

func TestASpentBudgetIsRecordedAsSkippedBudgetButStillFallsBackAsTimeout(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	for _, email := range []string{"a@example.com", "b@example.com"} {
		c := apitest.HomeWithResident(t, app, email)
		apitest.SetBaseline(t, c, map[string]any{"monday": 4})
		app.Clock.Set(apitest.MondayAt(6))
		apitest.CreateChore(t, c, apitest.Chore("One", 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	fake := llmalloc.NewFakeClient()
	fake.Block()
	p := dayplan.New(app.DB, allocation.Baseline{}, slog.New(slog.NewJSONHandler(app.Logs, nil)),
		dayplan.WithLLM(dayplan.LLMConfig{Proposer: llmalloc.New(fake), DailyCap: 3, CallTimeout: 5 * time.Second,
			TickBudget: 100 * time.Millisecond, Model: "claude-haiku-5-5"}))

	if _, err := p.RunDue(context.Background(), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	es := events(t, app)
	if len(es) != 2 {
		t.Fatalf("events = %+v, want 2", es)
	}
	got := []string{es[0].outcome, es[1].outcome}
	slices.Sort(got)
	if !slices.Equal(got, []string{"skipped_budget", "timeout"}) {
		t.Errorf("outcomes = %v", got)
	}
	for _, e := range es {
		if e.outcome == "skipped_budget" && e.model != "claude-haiku-5-5" {
			t.Errorf("skipped_budget event model = %q, want the configured model", e.model)
		}
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM allocation_runs WHERE fallback_reason = 'llm_timeout'`); n != 2 {
		t.Errorf("%d runs with llm_timeout, want 2: the run record is unchanged", n)
	}
}

func TestNoEventWhenThereIsNothingWorthAsking(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.HomeWithResident(t, app, "a@example.com") // no Chores, no Energy
	app.UseLLM(llmalloc.New(llmalloc.NewFakeClient()), llmDailyCap, time.Second)
	app.Clock.Set(apitest.MondayAt(7))

	app.RunAllocation(t)
	if es := events(t, app); len(es) != 0 {
		t.Fatalf("events = %+v, want none", es)
	}
}

func TestAnUnknownModelHasNoEstimatedCost(t *testing.T) {
	t.Parallel()
	app, _, fake, _ := llmHome(t)
	fake.ReportUsage("some-future-model", 10, 20)

	app.RunAllocation(t)
	e := theEvent(t, app)
	if e.model != "some-future-model" || e.estCostMicros != nil || e.inputTokens == nil {
		t.Fatalf("event = %+v", e)
	}
}

func TestAFailingInsertIsLoggedAndTheTickStillSucceeds(t *testing.T) {
	t.Parallel()
	app, _, _, _ := llmHome(t)
	if _, err := app.DB.Exec(context.Background(), `DROP TABLE llm_call_events`); err != nil {
		t.Fatal(err)
	}

	if sum := app.RunAllocation(t); sum.Planned != 1 || sum.Failed != 0 {
		t.Fatalf("summary = %+v", sum)
	}
	if !app.Logs.Contains("llm call event not recorded") {
		t.Errorf("logs lack the warning:\n%s", app.Logs.String())
	}
}

// A call whose plan was never refereed (the Home was planned meanwhile) still
// cost a call and tokens: it is recorded as error, with no run.
func TestAnUnrefereedProposalIsRecordedAsErrorWithoutARun(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	app.UseLLM(peek{llmalloc.New(fake), func() {
		// Another invocation plans the Home during the call.
		if _, err := dayplan.New(app.DB, allocation.Baseline{}, slog.New(slog.NewJSONHandler(app.Logs, nil))).
			PlanHome(context.Background(), homeIDOf(t, a), app.Clock.Now()); err != nil {
			t.Error(err)
		}
	}}, llmDailyCap, time.Second)

	app.RunAllocation(t)
	e := theEvent(t, app)
	if e.outcome != "error" || e.runID != nil || e.inputTokens == nil {
		t.Fatalf("event = %+v", e)
	}
}

func TestAProposalForAnotherDayIsRecordedAsErrorWithoutTheBaselineRun(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	home := homeIDOf(t, a)
	app.UseLLM(peek{llmalloc.New(fake), func() {
		// The Home moves to a zone where it is still the day before.
		if _, err := app.DB.Exec(context.Background(), `UPDATE homes SET timezone = 'Pacific/Pago_Pago' WHERE id = $1`, home); err != nil {
			t.Error(err)
		}
	}}, llmDailyCap, time.Second)

	app.RunAllocation(t)
	e := theEvent(t, app)
	if e.outcome != "error" || e.runID != nil || e.inputTokens == nil {
		t.Fatalf("event = %+v", e)
	}
}

func TestEventsHoldOnlyIdsNumbersAndVocabulary(t *testing.T) {
	t.Parallel()
	app, _, fake, st := llmHome(t)
	r := st.Residents[0]
	fake.Answer(answer(give(task(st, 1, 0), r), give(task(st, 1, 1), r), give(task(st, 1, 2), r)))
	app.RunAllocation(t)

	rows, err := app.DB.Query(context.Background(), `
		SELECT column_name FROM information_schema.columns WHERE table_name = 'llm_call_events' ORDER BY 1`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var cols []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			t.Fatal(err)
		}
		cols = append(cols, c)
	}
	want := []string{"created_at", "est_cost_micros", "home_id", "id", "input_tokens",
		"latency_ms", "local_date", "model", "outcome", "output_tokens", "run_id", "service", "violation_kinds"}
	if !slices.Equal(cols, want) {
		t.Fatalf("columns = %v, want %v", cols, want)
	}

	e := theEvent(t, app)
	outcomes := []string{"accepted", "rejected_by_referee", "invalid_response", "timeout", "error", "skipped_cap", "skipped_budget"}
	if !slices.Contains(outcomes, e.outcome) || e.service != "allocator" || e.model != "claude-haiku-5-5" {
		t.Errorf("event = %+v holds a value outside the vocabulary", e)
	}
	for _, k := range e.violationKinds {
		for _, c := range k {
			if c != '_' && (c < 'a' || c > 'z') {
				t.Errorf("violation kind %q is not a vocabulary word", k)
			}
		}
	}
}
