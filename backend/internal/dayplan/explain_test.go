package dayplan_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// exHome is A and B, each with Energy 4 on Monday and five Effort-2 Chores, at
// 07:00 with the clock set to the Allocation time. Both fakes are plugged in:
// the allocator fake always fails, so the baseline plans (and still takes its
// slot of the cap), and the explainer fake is the one the tests script.
type exHome struct {
	app    *apitest.App
	a, b   *apitest.Client
	ra, rb string // Resident ids
	alloc  *llmalloc.FakeClient
	expl   *llmalloc.FakeClient
}

func newExHome(t *testing.T, opts ...apitest.Option) exHome {
	t.Helper()
	app := apitest.Start(t, opts...)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	h := exHome{app: app, a: a, b: b, alloc: llmalloc.NewFakeClient(), expl: llmalloc.NewFakeClient()}
	h.alloc.Fail(errors.New("503 overloaded"))
	h.ra, h.rb = residentID(t, app, "a@example.com"), residentID(t, app, "b@example.com")
	app.UseLLM(llmalloc.New(h.alloc), 3, time.Second)
	app.UseExplainer(llmalloc.NewExplainer(h.expl), 0)
	return h
}

// item is one explainer entry; the Portuguese text is the English one with a
// "pt " prefix.
func item(id, en string) string {
	b, _ := json.Marshal(map[string]string{"resident_id": id, "en_US": en, "pt_BR": "pt " + en})
	return string(b)
}

// say is an explainer answer holding the entries.
func say(entries ...string) string {
	return `{"explanations": [` + strings.Join(entries, ",") + `]}`
}

// explanation is the caller's explanation in the Day Plan: source and both
// texts, or ok false when it is null.
func explanationOf(t *testing.T, c *apitest.Client) (source, en, pt string, ok bool) {
	t.Helper()
	r := apitest.DayPlan(t, c)
	x, has := r.Body["explanation"]
	if !has {
		t.Fatalf("no explanation key in %s", r.Raw)
	}
	if x == nil {
		return "", "", "", false
	}
	m := x.(map[string]any)
	text := m["text"].(map[string]any)
	return m["source"].(string), text["en-US"].(string), text["pt-BR"].(string), true
}

// factsOf rebuilds the caller's Facts from their Day Plan view, to compute
// the template the same facts must give.
// checkin is the level the caller checked in with, if they did.
func factsOf(t *testing.T, c *apitest.Client, checkin ...string) explain.Facts {
	t.Helper()
	body := apitest.DayPlan(t, c).Body
	f := explain.Facts{Energy: int(body["energy"].(float64)), Tasks: []explain.Task{}, Pool: []string{}}
	if len(checkin) > 0 {
		f.Checkin = checkin[0]
	}
	for _, tk := range apitest.TaskList(t, body["mine"]) {
		f.Tasks = append(f.Tasks, explain.Task{Reason: tk["reason"].(string), Effort: int(tk["currentEffort"].(float64)), People: int(tk["people"].(float64))})
	}
	for _, tk := range apitest.TaskList(t, body["pool"]) {
		f.Pool = append(f.Pool, tk["reason"].(string))
	}
	return f
}

func llmCalls(t *testing.T, app *apitest.App) int {
	t.Helper()
	return apitest.Count(t, app, `SELECT coalesce(sum(calls), 0) FROM llm_calls`)
}

func wantTemplate(t *testing.T, c *apitest.Client, who string, checkin ...string) {
	t.Helper()
	source, en, pt, ok := explanationOf(t, c)
	want := explain.Template(factsOf(t, c, checkin...)).Joined()
	if !ok || source != "template" || en != want.EnUS || pt != want.PtBR {
		t.Fatalf("%s: explanation = %q %q %q, want the template %+v", who, source, en, pt, want)
	}
}

// AC 1: every Day Plan has an explanation, with the LLM off.
func TestEveryDayPlanHasAnExplanationEvenWithTheLLMOff(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	for who, c := range map[string]*apitest.Client{"a": a, "b": b} {
		source, en, pt, ok := explanationOf(t, c)
		if !ok || source != "template" || en == "" || pt == "" {
			t.Errorf("%s: explanation = %q %q %q %v", who, source, en, pt, ok)
		}
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM llm_calls`); n != 0 {
		t.Errorf("%d llm_calls rows with the LLM off", n)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM day_plan_explanations`); n != 0 {
		t.Errorf("%d stored explanations for templates", n)
	}
}

func TestADrainedResidentAndAHomeWithNothingAssignableStillGetOne(t *testing.T) {
	t.Parallel()
	_, a, b := apitest.DuoHome(t, 0, 0) // no Energy anywhere: Carry stays in the pool
	for who, c := range map[string]*apitest.Client{"a": a, "b": b} {
		source, en, pt, ok := explanationOf(t, c)
		if !ok || source != "template" || !strings.Contains(en, "Rest is the plan") || !strings.Contains(pt, "descansar") {
			t.Errorf("%s: explanation = %q %q %q %v", who, source, en, pt, ok)
		}
	}

	app := apitest.Start(t)
	empty := apitest.HomeWithResident(t, app, "c@example.com") // no Chores at all
	apitest.SetBaseline(t, empty, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	if source, en, _, ok := explanationOf(t, empty); !ok || source != "template" || !strings.Contains(en, "Nothing needs you today") {
		t.Errorf("empty Home: explanation = %q %q %v", source, en, ok)
	}
}

func TestADrainedCheckInGivesTheRestSummary(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	apitest.CheckIn(t, a, "drained")
	wantTemplate(t, a, "a", "drained")
	_, en, pt, _ := explanationOf(t, a)
	if !strings.HasPrefix(en, "Rest is the plan today.") || !strings.HasPrefix(pt, "Hoje o plano é descansar.") {
		t.Fatalf("got %q / %q", en, pt)
	}
}

func TestALowCheckInGivesTheLighterDayHeadline(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	apitest.CheckIn(t, a, "low")
	wantTemplate(t, a, "a", "low")
	_, en, pt, _ := explanationOf(t, a)
	if !strings.HasPrefix(en, "A lighter day, with Low Energy.") || !strings.HasPrefix(pt, "Dia mais leve, com energia baixa.") {
		t.Fatalf("got %q / %q", en, pt)
	}
}

func TestThereIsNoExplanationBeforeThePlanOrForARejectedRun(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	if _, _, _, ok := explanationOf(t, h.a); ok {
		t.Error("an explanation before the plan")
	}

	h.app.UseAllocator(overEnergy{})
	if sum := h.app.RunAllocation(t); sum.Rejected != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	if _, _, _, ok := explanationOf(t, h.a); ok {
		t.Error("an explanation for a rejected run")
	}
	if h.expl.Calls() != 0 {
		t.Errorf("explainer calls = %d for a rejected run", h.expl.Calls())
	}
}

func TestAResidentWhoJoinedAfterThePlanGetsATemplate(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Hi A."), item(h.rb, "Hi B.")))
	h.app.RunAllocation(t)
	c := apitest.ExtraResident(t, h.app, h.a, "c@example.com")
	source, en, _, ok := explanationOf(t, c)
	if !ok || source != "template" || !strings.Contains(en, "Rest is the plan") {
		t.Fatalf("explanation = %q %q %v", source, en, ok)
	}
}

func TestTheLLMTextIsUsedAndEachResidentSeesOnlyTheirOwn(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))

	h.app.RunAllocation(t)
	for who, want := range map[string]struct {
		c  *apitest.Client
		en string
	}{"a": {h.a, "Alpha text."}, "b": {h.b, "Bravo text."}} {
		source, en, pt, ok := explanationOf(t, want.c)
		if !ok || source != "llm" || en != want.en || pt != "pt "+want.en {
			t.Errorf("%s: explanation = %q %q %q", who, source, en, pt)
		}
		if raw := apitest.DayPlan(t, want.c).Raw; strings.Count(string(raw), "text.") != 2 {
			t.Errorf("%s: the view holds more than their own text: %s", who, raw)
		}
	}
	if h.expl.Calls() != 1 {
		t.Fatalf("explainer calls = %d, want one for the whole Home", h.expl.Calls())
	}
	user := h.expl.LastRequest().User
	for _, leak := range []string{"a@example.com", "b@example.com", "One", "Two", "Three", "Four", "Five"} {
		if strings.Contains(user, leak) {
			t.Errorf("the request holds %q: %s", leak, user)
		}
	}
	if !strings.Contains(user, h.ra) || !strings.Contains(user, h.rb) {
		t.Errorf("the request lacks the Resident ids: %s", user)
	}
	if got := llmCalls(t, h.app); got != 2 {
		t.Errorf("llm_calls = %d, want 2 (allocator and explanation)", got)
	}
}

// AC 2: a fake LLM failure produces the templated explanation.
func TestAnLLMFailureGivesTheTemplate(t *testing.T) {
	t.Parallel()
	for name, set := range map[string]func(*llmalloc.FakeClient){
		"client error": func(f *llmalloc.FakeClient) { f.Fail(errors.New("503 overloaded")) },
		"timeout":      func(f *llmalloc.FakeClient) { f.Block() },
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.app.UseLLM(llmalloc.New(h.alloc), 3, 50*time.Millisecond)
			set(h.expl)

			if sum := h.app.RunAllocation(t); sum.Planned != 1 {
				t.Fatalf("summary = %+v", sum)
			}
			wantTemplate(t, h.a, "a")
			wantTemplate(t, h.b, "b")
			if r := theRun(t, h.app); r.outcome != "planned" || len(r.assignments) != 4 {
				t.Errorf("the plan was affected: %+v", r)
			}
			if h.expl.Calls() != 1 || llmCalls(t, h.app) != 2 {
				t.Errorf("explainer calls = %d, llm_calls = %d: a failed call must still count", h.expl.Calls(), llmCalls(t, h.app))
			}
		})
	}
}

func TestAnInvalidWholeAnswerGivesTheTemplateForEveryone(t *testing.T) {
	t.Parallel()
	for name, answer := range map[string]string{
		"not json":      `nope`,
		"unknown field": `{"explanations": [], "extra": true}`,
		"missing list":  `{}`,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.expl.Answer(answer)
			h.app.RunAllocation(t)
			wantTemplate(t, h.a, "a")
			wantTemplate(t, h.b, "b")
			if llmCalls(t, h.app) != 2 {
				t.Errorf("llm_calls = %d, want 2", llmCalls(t, h.app))
			}
		})
	}
}

func TestABadEntryGivesTheTemplateForThatResidentOnly(t *testing.T) {
	t.Parallel()
	for name, bad := range map[string]func(h exHome) []string{
		"unknown resident": func(h exHome) []string { return []string{item("00000000-0000-0000-0000-000000000000", "Hi.")} },
		"duplicate":        func(h exHome) []string { return []string{item(h.ra, "First."), item(h.ra, "Second.")} },
		"empty text":       func(h exHome) []string { return []string{item(h.ra, "")} },
		"over length":      func(h exHome) []string { return []string{item(h.ra, strings.Repeat("a", 401))} },
		"markup":           func(h exHome) []string { return []string{item(h.ra, "Hi <b>you</b>.")} },
		"url":              func(h exHome) []string { return []string{item(h.ra, "Go to https://evil.example now.")} },
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.expl.Answer(say(append(bad(h), item(h.rb, "Bravo text."))...))

			h.app.RunAllocation(t)
			wantTemplate(t, h.a, "a")
			if source, en, _, _ := explanationOf(t, h.b); source != "llm" || en != "Bravo text." {
				t.Errorf("b: explanation = %q %q, want their LLM text", source, en)
			}
		})
	}
}

// AC 3: explanation calls respect the per-Home cap.
func TestTheCapLeavesTheLastSlotToTheAllocator(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	if _, err := h.app.DB.Exec(context.Background(), `INSERT INTO llm_calls (home_id, call_date, calls) VALUES ($1, '2026-03-02', 2)`,
		homeIDOf(t, h.a)); err != nil {
		t.Fatal(err)
	}

	h.app.RunAllocation(t)
	if h.alloc.Calls() != 1 || h.expl.Calls() != 0 {
		t.Fatalf("allocator calls = %d, explainer calls = %d, want 1 and 0", h.alloc.Calls(), h.expl.Calls())
	}
	wantTemplate(t, h.a, "a")
	wantTemplate(t, h.b, "b")
	if got := llmCalls(t, h.app); got != 3 {
		t.Errorf("llm_calls = %d, want the cap of 3", got)
	}
}

func TestAtTheCapNeitherAskedAndBothFallBack(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	if _, err := h.app.DB.Exec(context.Background(), `INSERT INTO llm_calls (home_id, call_date, calls) VALUES ($1, '2026-03-02', 3)`,
		homeIDOf(t, h.a)); err != nil {
		t.Fatal(err)
	}

	h.app.RunAllocation(t)
	if h.alloc.Calls() != 0 || h.expl.Calls() != 0 {
		t.Fatalf("allocator calls = %d, explainer calls = %d, want none", h.alloc.Calls(), h.expl.Calls())
	}
	wantTemplate(t, h.a, "a")
	if r := theRun(t, h.app); r.fallback == nil || *r.fallback != "llm_daily_cap_reached" {
		t.Errorf("run = %+v", r)
	}
}

func TestTheHappyPathUsesTwoSlotsAndASecondTickMakesNoCalls(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))

	h.app.RunAllocation(t)
	if got := llmCalls(t, h.app); got != 2 {
		t.Fatalf("llm_calls = %d, want 2 of the cap of 3", got)
	}
	h.app.RunAllocation(t)
	if h.alloc.Calls() != 1 || h.expl.Calls() != 1 || llmCalls(t, h.app) != 2 {
		t.Fatalf("a second tick made calls: allocator %d, explainer %d, llm_calls %d", h.alloc.Calls(), h.expl.Calls(), llmCalls(t, h.app))
	}
}

// A stored text describes the plan it was written for; once the Resident's
// plan changes it reads back as the template of the live reasons.
func TestTextGoesStaleWhenTheCallersPlanChanges(t *testing.T) {
	t.Parallel()
	changes := map[string]func(t *testing.T, h exHome){
		"check-in": func(t *testing.T, h exHome) { apitest.CheckIn(t, h.a, "energized") },
		"refuse": func(t *testing.T, h exHome) {
			apitest.MustAct(t, h.a, "refuse", apitest.MineOf(t, h.a)[0]["id"].(string))
		},
		"take": func(t *testing.T, h exHome) {
			apitest.MustAct(t, h.a, "take", apitest.TaskList(t, apitest.DayPlan(t, h.a).Body["pool"])[0]["id"].(string))
		},
		"swap": func(t *testing.T, h exHome) {
			p := pairOf(t, h.a, h.b)
			mustOffer(t, h.a, p.a, p.b)
			mustSwapAct(t, h.b, swapsOf(t, h.b, "incoming")[0]["id"].(string), "accept")
		},
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
			h.app.RunAllocation(t)
			if source, _, _, _ := explanationOf(t, h.a); source != "llm" {
				t.Fatalf("before the change a has %q", source)
			}

			change(t, h)
			wantTemplate(t, h.a, "a")
			if name == "refuse" {
				// The summary tells the pool by its count, so the refused Task
				// shows as a pool reason in the facts and as an open task in the text.
				if !slices.Contains(factsOf(t, h.a).Pool, "refused") {
					t.Error("the refused Task is not in the pool")
				}
				if _, en, _, _ := explanationOf(t, h.a); !strings.Contains(en, "open task") {
					t.Errorf("the template ignores the live pool: %q", en)
				}
			}
			if name == "swap" {
				wantTemplate(t, h.b, "b") // a swap changes both sides
				return
			}
			if source, en, _, _ := explanationOf(t, h.b); source != "llm" || en != "Bravo text." {
				t.Errorf("b's text was touched by a's change: %q %q", source, en)
			}
		})
	}
}

func TestAnAcceptedPlanKeepsItsTextWhenATaskIsCompleted(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)
	id := apitest.MineOf(t, h.a)[0]["id"].(string)
	apitest.MustAct(t, h.a, "accept", id)
	apitest.MustAct(t, h.a, "complete", id)
	if source, en, _, _ := explanationOf(t, h.a); source != "llm" || en != "Alpha text." {
		t.Fatalf("explanation = %q %q after accepting and completing a Task", source, en)
	}
}

// A spent explain budget skips the call without reserving a slot, and the tick
// still sends its nudges.
func TestASpentExplainBudgetSkipsTheCallAndStillNudges(t *testing.T) {
	t.Parallel()
	h := newExHome(t, apitest.WithPush("k"))
	subscribe(t, h.a, "a")
	subscribe(t, h.b, "b")
	h.expl.Block()
	h.app.UseExplainer(llmalloc.NewExplainer(h.expl), time.Nanosecond)

	if sum := h.app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	if h.expl.Calls() != 0 {
		t.Errorf("explainer calls = %d, want the call skipped", h.expl.Calls())
	}
	if got := llmCalls(t, h.app); got != 1 {
		t.Errorf("llm_calls = %d, want only the allocator's slot", got)
	}
	wantTemplate(t, h.a, "a")
	wantTemplate(t, h.b, "b")
	wantPushes(t, h.app, ready+":a", ready+":b")
	if !h.app.Logs.Contains("explain_budget_spent") {
		t.Errorf("the skip was not logged: %s", h.app.Logs.String())
	}
}

func TestNothingToExplainSpendsNoCall(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	c := apitest.HomeWithResident(t, app, "a@example.com") // no Chores: no Task for anyone
	apitest.SetBaseline(t, c, map[string]any{"monday": 4})
	alloc, expl := llmalloc.NewFakeClient(), llmalloc.NewFakeClient()
	app.UseLLM(llmalloc.New(alloc), 3, time.Second)
	app.UseExplainer(llmalloc.NewExplainer(expl), 0)
	app.Clock.Set(apitest.MondayAt(7))

	app.RunAllocation(t)
	if expl.Calls() != 0 || llmCalls(t, app) != 0 {
		t.Fatalf("explainer calls = %d, llm_calls = %d, want none", expl.Calls(), llmCalls(t, app))
	}
	if _, _, _, ok := explanationOf(t, c); !ok {
		t.Error("a planned Home without Tasks has no explanation")
	}
}

// The stored explanation goes with its Resident (cascade).
func TestAStoredExplanationGoesWhenTheResidentLeaves(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)
	if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations`); n != 2 {
		t.Fatalf("%d stored explanations, want 2", n)
	}
	if r := apitest.LeaveHome(h.b); r.Status >= 300 {
		t.Fatalf("leave = %d %s", r.Status, r.Raw)
	}
	if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations`); n != 1 {
		t.Fatalf("%d stored explanations after B left, want 1", n)
	}
}
