package dayplan_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// explainerEvents are the llm_call_events rows of the explainer.
func explainerEvents(t *testing.T, app *apitest.App) []event {
	t.Helper()
	var out []event
	for _, e := range events(t, app) {
		if e.service == "explainer" {
			out = append(out, e)
		}
	}
	return out
}

func theExplainerEvent(t *testing.T, app *apitest.App) event {
	t.Helper()
	es := explainerEvents(t, app)
	if len(es) != 1 {
		t.Fatalf("%d explainer rows, want 1: %+v", len(es), es)
	}
	return es[0]
}

func wantItems(t *testing.T, e event, sent int32, accepted *int32) {
	t.Helper()
	if e.itemsSent == nil || *e.itemsSent != sent {
		t.Errorf("items_sent = %v, want %d", e.itemsSent, sent)
	}
	switch {
	case accepted == nil && e.itemsAccepted != nil:
		t.Errorf("items_accepted = %d, want null", *e.itemsAccepted)
	case accepted != nil && (e.itemsAccepted == nil || *e.itemsAccepted != *accepted):
		t.Errorf("items_accepted = %v, want %d", e.itemsAccepted, *accepted)
	}
}

func n32(n int32) *int32 { return &n }

func TestAnAcceptedExplanationIsRecordedWithEveryItemKept(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))

	h.app.RunAllocation(t)
	e := theExplainerEvent(t, h.app)
	if e.outcome != "accepted" {
		t.Fatalf("event = %+v", e)
	}
	wantItems(t, e, 2, n32(2))
	// Fields, as for the allocator rows.
	var runID string
	if err := h.app.DB.QueryRow(context.Background(), `SELECT id FROM allocation_runs`).Scan(&runID); err != nil {
		t.Fatal(err)
	}
	if e.runID == nil || *e.runID != runID || e.homeID == nil || *e.homeID != homeIDOf(t, h.a) {
		t.Errorf("home/run = %v/%v, want %s/%s", e.homeID, e.runID, homeIDOf(t, h.a), runID)
	}
	if !e.localDate.Equal(time.Date(2026, time.March, 2, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("local_date = %v", e.localDate)
	}
	if e.model != "claude-haiku-5-5" || e.latencyMs == nil || e.inputTokens == nil || *e.inputTokens != 1000 ||
		e.outputTokens == nil || *e.outputTokens != 200 || e.estCostMicros == nil || *e.estCostMicros <= 0 {
		t.Errorf("event = %+v, want the default model, latency, tokens and a cost", e)
	}
}

func TestAPartialAcceptanceIsVisibleInTheItemCounts(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, ""), item(h.rb, "Bravo text.")))

	h.app.RunAllocation(t)
	e := theExplainerEvent(t, h.app)
	if e.outcome != "accepted" {
		t.Fatalf("event = %+v", e)
	}
	wantItems(t, e, 2, n32(1))
}

func TestAnExplanationWithNoValidSummaryIsRecordedAsInvalidResponse(t *testing.T) {
	t.Parallel()
	for name, answer := range map[string]func(h exHome) string{
		"not json":           func(exHome) string { return `nope` },
		"every item invalid": func(h exHome) string { return say(item(h.ra, ""), item(h.rb, "")) },
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.expl.Answer(answer(h))

			h.app.RunAllocation(t)
			e := theExplainerEvent(t, h.app)
			if e.outcome != "invalid_response" || e.inputTokens == nil || e.latencyMs == nil {
				t.Fatalf("event = %+v, want invalid_response with tokens and a latency", e)
			}
			wantItems(t, e, 2, n32(0))
		})
	}
}

func TestEachFailedExplanationCallIsRecordedWithItsOutcome(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		set  func(*llmalloc.FakeClient)
		want string
	}{
		"timeout": {func(f *llmalloc.FakeClient) { f.Block() }, "timeout"},
		"error":   {func(f *llmalloc.FakeClient) { f.Fail(errors.New("boom")) }, "error"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.app.UseLLM(llmalloc.New(h.alloc), 3, 50*time.Millisecond)
			tc.set(h.expl)

			h.app.RunAllocation(t)
			e := theExplainerEvent(t, h.app)
			if e.outcome != tc.want || e.latencyMs == nil || e.inputTokens != nil || e.estCostMicros != nil {
				t.Fatalf("event = %+v, want %s with a latency and no usage", e, tc.want)
			}
			wantItems(t, e, 2, n32(0))
		})
	}
}

func TestAnExplanationOverTheCapIsRecordedAsSkippedCap(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.app.UseLLM(llmalloc.New(h.alloc), 1, time.Second) // the allocator takes the only slot
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))

	h.app.RunAllocation(t)
	e := theExplainerEvent(t, h.app)
	if e.outcome != "skipped_cap" || h.expl.Calls() != 0 {
		t.Fatalf("event = %+v, explainer calls = %d", e, h.expl.Calls())
	}
	wantItems(t, e, 2, nil)
	if e.latencyMs != nil || e.inputTokens != nil || e.outputTokens != nil || e.estCostMicros != nil || e.runID == nil || e.model == "" {
		t.Errorf("skipped event = %+v, want a run and the configured model but no latency, tokens or cost", e)
	}
}

func TestASpentExplainBudgetIsRecordedAsSkippedBudget(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Block()
	h.app.UseExplainer(llmalloc.NewExplainer(h.expl), time.Nanosecond)

	h.app.RunAllocation(t)
	e := theExplainerEvent(t, h.app)
	if e.outcome != "skipped_budget" || h.expl.Calls() != 0 {
		t.Fatalf("event = %+v, explainer calls = %d", e, h.expl.Calls())
	}
	wantItems(t, e, 2, nil)
	if e.latencyMs != nil || e.inputTokens != nil || e.runID == nil || e.model == "" {
		t.Errorf("skipped event = %+v", e)
	}
	// Behaviour for Residents is unchanged, and the reason is still logged.
	wantTemplate(t, h.a, "a")
	if !h.app.Logs.Contains("explain_budget_spent") {
		t.Errorf("the skip was not logged: %s", h.app.Logs.String())
	}
}

func TestAStoreFailureAfterAGoodAnswerIsRecordedAsErrorWithItsTokens(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	if _, err := h.app.DB.Exec(context.Background(), `DROP TABLE day_plan_explanations`); err != nil {
		t.Fatal(err)
	}

	h.app.RunAllocation(t)
	e := theExplainerEvent(t, h.app)
	if e.outcome != "error" || e.inputTokens == nil || e.latencyMs == nil {
		t.Fatalf("event = %+v, want error with tokens", e)
	}
	wantItems(t, e, 2, n32(0))
}

func TestNoExplainerEventWhenThereIsNoResidentToExplain(t *testing.T) {
	t.Parallel()
	t.Run("everyone drained", func(t *testing.T) {
		t.Parallel()
		h := newExHome(t)
		apitest.CheckIn(t, h.a, "drained")
		apitest.CheckIn(t, h.b, "drained")
		h.app.RunAllocation(t)
		if es := explainerEvents(t, h.app); len(es) != 0 {
			t.Fatalf("events = %+v, want none", es)
		}
	})
	t.Run("drained and budget spent", func(t *testing.T) {
		t.Parallel()
		h := newExHome(t)
		apitest.CheckIn(t, h.a, "drained")
		apitest.CheckIn(t, h.b, "drained")
		h.app.UseExplainer(llmalloc.NewExplainer(h.expl), time.Nanosecond)
		h.app.RunAllocation(t)
		if es := explainerEvents(t, h.app); len(es) != 0 {
			t.Fatalf("events = %+v, want none: a spent budget must not skip before there is anyone to ask", es)
		}
	})
	t.Run("rejected run", func(t *testing.T) {
		t.Parallel()
		h := newExHome(t)
		h.app.UseAllocator(overEnergy{})
		if sum := h.app.RunAllocation(t); sum.Rejected != 1 {
			t.Fatalf("summary = %+v", sum)
		}
		if es := explainerEvents(t, h.app); len(es) != 0 {
			t.Fatalf("events = %+v, want none", es)
		}
	})
	t.Run("no tasks", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		c := apitest.HomeWithResident(t, app, "a@example.com")
		apitest.SetBaseline(t, c, map[string]any{"monday": 4})
		app.UseLLM(llmalloc.New(llmalloc.NewFakeClient()), 3, time.Second)
		app.UseExplainer(llmalloc.NewExplainer(llmalloc.NewFakeClient()), 0)
		app.Clock.Set(apitest.MondayAt(7))
		app.RunAllocation(t)
		if es := explainerEvents(t, app); len(es) != 0 {
			t.Fatalf("events = %+v, want none", es)
		}
	})
}

func TestAFailingExplainerEventInsertNeverFailsTheTick(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	if _, err := h.app.DB.Exec(context.Background(), `DROP TABLE llm_call_events`); err != nil {
		t.Fatal(err)
	}

	if sum := h.app.RunAllocation(t); sum.Planned != 1 || sum.Failed != 0 {
		t.Fatalf("summary = %+v", sum)
	}
	if source, _, _ := summaryOf(t, h.a); source != "llm" {
		t.Errorf("a: source = %q, want the stored LLM text", source)
	}
	if !h.app.Logs.Contains("llm call event not recorded") {
		t.Errorf("logs lack the warning:\n%s", h.app.Logs.String())
	}
	if strings.Contains(h.app.Logs.String(), "explanations panicked") {
		t.Error("the record path panicked")
	}
}

func TestAnExplainerRowIsLeftBesideTheAllocatorRow(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)

	var services []string
	for _, e := range events(t, h.app) {
		services = append(services, e.service)
		if e.service == "allocator" && (e.itemsSent != nil || e.itemsAccepted != nil) {
			t.Errorf("allocator row has items: %+v", e)
		}
	}
	slices.Sort(services)
	if !slices.Equal(services, []string{"allocator", "explainer"}) {
		t.Errorf("services = %v", services)
	}
}
