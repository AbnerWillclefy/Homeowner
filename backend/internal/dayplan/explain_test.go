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

// item is one explainer entry: the headline is en and the detail is "Detail "
// plus en; the Portuguese texts are those with a "pt " prefix.
func item(id, en string) string {
	b, _ := json.Marshal(map[string]string{
		"resident_id":    id,
		"headline_en_US": en, "headline_pt_BR": "pt " + en,
		"detail_en_US": "Detail " + en, "detail_pt_BR": "pt detail " + en,
	})
	return string(b)
}

// say is an explainer answer holding the entries.
func say(entries ...string) string {
	return `{"explanations": [` + strings.Join(entries, ",") + `]}`
}

// summaryOf is the caller's explanation in the Day Plan: source and the
// headline and detail in both languages, or ok false when it is null. It also
// checks that text is always the headline followed by the detail.
func summaryOf(t *testing.T, c *apitest.Client) (source string, s explain.Summary, ok bool) {
	t.Helper()
	r := apitest.DayPlan(t, c)
	x, has := r.Body["explanation"]
	if !has {
		t.Fatalf("no explanation key in %s", r.Raw)
	}
	if x == nil {
		return "", explain.Summary{}, false
	}
	m := x.(map[string]any)
	texts := func(key string) explain.Texts {
		v, isMap := m[key].(map[string]any)
		if !isMap {
			t.Fatalf("explanation has no %q object: %s", key, r.Raw)
		}
		return explain.Texts{EnUS: v["en-US"].(string), PtBR: v["pt-BR"].(string)}
	}
	s = explain.Summary{Headline: texts("headline"), Detail: texts("detail")}
	if got := texts("text"); got != s.Joined() {
		t.Fatalf("text = %+v, want the headline followed by the detail %+v", got, s.Joined())
	}
	return m["source"].(string), s, true
}

// explanationOf is summaryOf with the headline only, in both languages.
func explanationOf(t *testing.T, c *apitest.Client) (source, en, pt string, ok bool) {
	t.Helper()
	source, s, ok := summaryOf(t, c)
	return source, s.Headline.EnUS, s.Headline.PtBR, ok
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
	source, got, ok := summaryOf(t, c)
	want := explain.Template(factsOf(t, c, checkin...))
	if !ok || source != "template" || got != want {
		t.Fatalf("%s: explanation = %q %+v, want the template %+v", who, source, got, want)
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
		if raw := string(apitest.DayPlan(t, want.c).Raw); strings.Contains(raw, map[string]string{"a": "Bravo", "b": "Alpha"}[who]) {
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

// AC: the AI text carries a headline and a detail, and the joined text stays
// for a cached copy of the app.
func TestTheLLMSummaryHasAHeadlineADetailAndTheJoinedText(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)

	source, s, ok := summaryOf(t, h.a)
	want := explain.Summary{
		Headline: explain.Texts{EnUS: "Alpha text.", PtBR: "pt Alpha text."},
		Detail:   explain.Texts{EnUS: "Detail Alpha text.", PtBR: "pt detail Alpha text."},
	}
	if !ok || source != "llm" || s != want {
		t.Fatalf("explanation = %q %+v, want the LLM summary %+v", source, s, want)
	}
	text := apitest.DayPlan(t, h.a).Body["explanation"].(map[string]any)["text"].(map[string]any)
	if text["en-US"] != "Alpha text. Detail Alpha text." || text["pt-BR"] != "pt Alpha text. pt detail Alpha text." {
		t.Errorf("text = %v", text)
	}
}

// A part missing, blank or over its own limit gives the template for that
// Resident, and nothing is stored for them.
func TestAPartialOrInvalidAnswerStoresNothingAndGivesTheTemplate(t *testing.T) {
	t.Parallel()
	for name, mod := range map[string]map[string]string{
		"missing headline":  {"headline_pt_BR": ""},
		"blank detail":      {"detail_en_US": "   "},
		"headline over 120": {"headline_en_US": strings.Repeat("a", 121)},
		"detail over 280":   {"detail_pt_BR": strings.Repeat("a", 281)},
		"markup":            {"detail_en_US": "Do <b>this</b>."},
		"link":              {"headline_pt_BR": "Veja www.x.example."},
		"newline":           {"detail_pt_BR": "a\nb"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			m := map[string]string{
				"resident_id":    h.ra,
				"headline_en_US": "H.", "headline_pt_BR": "H.", "detail_en_US": "D.", "detail_pt_BR": "D.",
			}
			for k, v := range mod {
				m[k] = v
			}
			b, _ := json.Marshal(m)
			h.expl.Answer(say(string(b), item(h.rb, "Bravo text.")))
			h.app.RunAllocation(t)

			wantTemplate(t, h.a, "a")
			if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations WHERE resident_id = '`+h.ra+`'`); n != 0 {
				t.Errorf("%d rows stored for the invalid answer", n)
			}
			if source, _, _ := summaryOf(t, h.b); source != "llm" {
				t.Errorf("b: source = %q, want llm", source)
			}
		})
	}
}

// A client error stores nothing for anyone.
func TestAClientErrorStoresNothing(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Fail(errors.New("503 overloaded"))
	h.app.RunAllocation(t)
	wantTemplate(t, h.a, "a")
	if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations`); n != 0 {
		t.Errorf("%d rows stored after a client error", n)
	}
}

// An answer in the old shape (en_US and pt_BR) is rejected whole.
func TestAnAnswerInTheOldShapeGivesTheTemplate(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	old := func(id string) string {
		return `{"resident_id": "` + id + `", "en_US": "Old.", "pt_BR": "Velho."}`
	}
	h.expl.Answer(say(old(h.ra), old(h.rb)))
	h.app.RunAllocation(t)
	wantTemplate(t, h.a, "a")
	wantTemplate(t, h.b, "b")
	if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations`); n != 0 {
		t.Errorf("%d rows stored for the old shape", n)
	}
}

// A row written before the headline columns has none: it reads as absent, with
// no error.
func TestALegacyRowWithoutAHeadlineGivesTheTemplate(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)
	if source, _, _ := summaryOf(t, h.a); source != "llm" {
		t.Fatalf("before the change a has %q", source)
	}
	if _, err := h.app.DB.Exec(context.Background(), `UPDATE day_plan_explanations SET headline_en = NULL, headline_pt = NULL`); err != nil {
		t.Fatal(err)
	}
	wantTemplate(t, h.a, "a")
	wantTemplate(t, h.b, "b")
}

// A Drained Resident gets the rest summary whatever the source: they are not
// even asked about before the run...
func TestADrainedResidentIsNotAskedAboutAndGetsTheRestSummary(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	apitest.CheckIn(t, h.a, "drained")
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)

	if user := h.expl.LastRequest().User; strings.Contains(user, h.ra) || !strings.Contains(user, h.rb) {
		t.Errorf("the request must hold only b: %s", user)
	}
	wantTemplate(t, h.a, "a", "drained")
	if _, en, _, _ := explanationOf(t, h.a); !strings.HasPrefix(en, "Rest is the plan") {
		t.Errorf("headline = %q", en)
	}
	if source, _, _ := summaryOf(t, h.b); source != "llm" {
		t.Errorf("b: source = %q", source)
	}
}

// ... and a Drained Check-in after the text was written hides it.
func TestADrainedCheckInAfterTheLLMTextShowsTheRestSummary(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
	h.app.RunAllocation(t)
	if source, _, _ := summaryOf(t, h.a); source != "llm" {
		t.Fatalf("before the check-in a has %q", source)
	}
	apitest.CheckIn(t, h.a, "drained")
	wantTemplate(t, h.a, "a", "drained")
	if n := apitest.Count(t, h.app, `SELECT count(*) FROM day_plan_explanations WHERE resident_id = '`+h.ra+`'`); n != 1 {
		t.Errorf("the stored row was expected to stay, found %d", n)
	}
}

// A Normal or Energized Check-in does not change the wording, so the stored
// text stays.
func TestANormalOrEnergizedCheckInKeepsTheLLMText(t *testing.T) {
	t.Parallel()
	for _, level := range []string{"normal", "energized"} {
		t.Run(level, func(t *testing.T) {
			t.Parallel()
			h := newExHome(t)
			h.expl.Answer(say(item(h.ra, "Alpha text."), item(h.rb, "Bravo text.")))
			h.app.RunAllocation(t)
			apitest.CheckIn(t, h.a, level)
			if source, _, _ := summaryOf(t, h.a); source != "llm" {
				t.Errorf("after a %s check-in a has %q, want llm", level, source)
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
				if _, s, _ := summaryOf(t, h.a); !strings.Contains(s.Detail.EnUS, "open task") {
					t.Errorf("the template ignores the live pool: %q", s.Detail.EnUS)
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
