package llmalloc_test

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

func facts() []explain.ResidentFacts {
	return []explain.ResidentFacts{
		{ResidentID: "r1", Facts: explain.Facts{Energy: 5, Checkin: explain.CheckinNormal, Pool: []string{"no_energy_left", "no_energy_left"},
			Tasks: []explain.Task{{Reason: "liked", Category: "kitchen", Effort: 2, Importance: "essential", People: 1}}}},
		{ResidentID: "r2", Facts: explain.Facts{Energy: 0, Tasks: []explain.Task{}, Pool: []string{}}},
	}
}

func explainWith(t *testing.T, answer string) (map[string]explain.Summary, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	got, _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts())
	return got, err
}

// parts is the four texts of an entry: headline and detail, English first.
type parts struct{ headEn, headPt, detEn, detPt string }

func fine() parts {
	return parts{"A light day.", "Dia leve.", "You have one task.", "Você tem uma tarefa."}
}

func entry(id string, p parts) string {
	b, _ := json.Marshal(map[string]string{
		"resident_id": id, "headline_en_US": p.headEn, "headline_pt_BR": p.headPt,
		"detail_en_US": p.detEn, "detail_pt_BR": p.detPt,
	})
	return string(b)
}

func TestAGoodExplanationAnswerIsMappedByResident(t *testing.T) {
	t.Parallel()
	rest := parts{"Rest.", "Descanse.", "Nothing today.", "Nada hoje."}
	got, err := explainWith(t, `{"explanations": [`+entry("r1", fine())+`,`+entry("r2", rest)+`]}`)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]explain.Summary{
		"r1": {Headline: explain.Texts{EnUS: "A light day.", PtBR: "Dia leve."}, Detail: explain.Texts{EnUS: "You have one task.", PtBR: "Você tem uma tarefa."}},
		"r2": {Headline: explain.Texts{EnUS: "Rest.", PtBR: "Descanse."}, Detail: explain.Texts{EnUS: "Nothing today.", PtBR: "Nada hoje."}},
	}
	if !maps.Equal(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestWholeAnswerErrorsAreInvalidResponses(t *testing.T) {
	t.Parallel()
	huge := fine()
	huge.detEn = strings.Repeat("a", 70<<10)
	for name, answer := range map[string]string{
		"not json":            `nope`,
		"unknown field":       `{"explanations": [], "extra": 1}`,
		"unknown entry field": `{"explanations": [{"resident_id": "r1", "headline_en_US": "a", "headline_pt_BR": "b", "detail_en_US": "a", "detail_pt_BR": "b", "mood": "x"}]}`,
		"old shape":           `{"explanations": [{"resident_id": "r1", "en_US": "a", "pt_BR": "b"}]}`,
		"missing list":        `{}`,
		"null list":           `{"explanations": null}`,
		"trailing data":       `{"explanations": []} {}`,
		"too large":           `{"explanations": [` + entry("r1", huge) + `]}`,
	} {
		if _, err := explainWith(t, answer); !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: want ErrInvalidResponse, got %v", name, err)
		}
	}
}

func TestBadEntriesAreDroppedAndTheRestKept(t *testing.T) {
	t.Parallel()
	good := entry("r2", fine())
	with := func(edit func(*parts)) string {
		p := fine()
		edit(&p)
		return entry("r1", p)
	}
	for name, bad := range map[string]string{
		"unknown resident":  entry("zz", fine()),
		"missing headline":  `{"resident_id": "r1", "headline_pt_BR": "b", "detail_en_US": "a", "detail_pt_BR": "b"}`,
		"blank headline":    with(func(p *parts) { p.headEn = "  " }),
		"empty detail":      with(func(p *parts) { p.detPt = "" }),
		"headline too long": with(func(p *parts) { p.headPt = strings.Repeat("a", 121) }),
		"detail too long":   with(func(p *parts) { p.detEn = strings.Repeat("a", 281) }),
		"markup":            with(func(p *parts) { p.detEn = "<b>x</b>" }),
		"url":               with(func(p *parts) { p.headEn = "see https://x.example" }),
		"newline":           with(func(p *parts) { p.detPt = "a\nb" }),
	} {
		got, err := explainWith(t, `{"explanations": [`+bad+`,`+good+`]}`)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if _, has := got["r1"]; has || len(got) != 1 || got["r2"].Headline.EnUS != "A light day." {
			t.Errorf("%s: got %+v", name, got)
		}
	}
}

func TestADuplicateResidentIsDroppedEntirely(t *testing.T) {
	t.Parallel()
	got, err := explainWith(t, `{"explanations": [`+entry("r1", fine())+`,`+entry("r1", fine())+`,`+entry("r2", fine())+`]}`)
	if err != nil {
		t.Fatal(err)
	}
	if _, has := got["r1"]; has || len(got) != 1 {
		t.Fatalf("got %+v", got)
	}
}

// A repeated id is a confused answer: neither copy is trusted, whichever
// order the valid one comes in.
func TestARepeatedResidentIsDroppedEvenWhenOneCopyIsValid(t *testing.T) {
	t.Parallel()
	badParts := fine()
	badParts.detEn = "<b>x</b>"
	good, bad := entry("r1", fine()), entry("r1", badParts)
	for name, pair := range map[string]string{
		"valid first":   good + `,` + bad,
		"invalid first": bad + `,` + good,
	} {
		got, err := explainWith(t, `{"explanations": [`+pair+`,`+entry("r2", fine())+`]}`)
		if err != nil {
			t.Fatal(err)
		}
		if _, has := got["r1"]; has || len(got) != 1 {
			t.Errorf("%s: got %+v", name, got)
		}
	}
}

func TestAMissingResidentGetsNoEntry(t *testing.T) {
	t.Parallel()
	got, err := explainWith(t, `{"explanations": []}`)
	if err != nil || len(got) != 0 {
		t.Fatalf("got %+v, %v", got, err)
	}
}

func TestExplainerClientErrorsPassThrough(t *testing.T) {
	t.Parallel()
	boom := errors.New("boom")
	fake := llmalloc.NewFakeClient()
	fake.Fail(boom)
	if _, _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestExplainPassesTheUsageUpOnSuccessAndOnAnInvalidAnswer(t *testing.T) {
	t.Parallel()
	want := llmalloc.Usage{Model: "claude-haiku-5-5", InputTokens: 900, OutputTokens: 410}
	for name, answer := range map[string]string{"valid": `{"explanations": []}`, "invalid": `nope`} {
		fake := llmalloc.NewFakeClient()
		fake.ReportUsage(want.Model, want.InputTokens, want.OutputTokens)
		fake.Answer(answer)
		_, usage, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts())
		if (name == "invalid") != errors.Is(err, llmalloc.ErrInvalidResponse) || usage == nil || *usage != want {
			t.Errorf("%s: usage = %+v, err = %v", name, usage, err)
		}
	}
}

func TestExplainReportsNoUsageWhenTheClientFailsWithout(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Fail(errors.New("boom"))
	if _, usage, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err == nil || usage != nil {
		t.Fatalf("usage = %+v, err = %v", usage, err)
	}
	boom := errors.New("paid")
	fake.FailWithUsage(boom)
	if _, usage, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); !errors.Is(err, boom) || usage == nil {
		t.Fatalf("usage = %+v, err = %v", usage, err)
	}
}

func TestAnExplanationCallIsBoundedByTheResidentCount(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	e := llmalloc.NewExplainer(fake)
	if _, _, err := e.Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	two := fake.LastRequest().MaxTokens
	if _, _, err := e.Explain(context.Background(), append(facts(), facts()...)); err != nil {
		t.Fatal(err)
	}
	if four := fake.LastRequest().MaxTokens; four <= two || four > 4000 {
		t.Fatalf("max tokens: two residents %d, four %d", two, four)
	}
}

// The model sees opaque ids, numbers and fixed vocabulary only: no names, no
// Chore titles, no free text.
func TestTheExplanationPromptHoldsOnlyIDsNumbersAndVocabulary(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	if _, _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	var input any
	if err := json.Unmarshal([]byte(fake.LastRequest().User), &input); err != nil {
		t.Fatal(err)
	}
	keys := map[string]bool{}
	collectKeys(input, keys)
	want := []string{"category", "checkin", "effort", "energy", "facts", "importance", "people", "pool", "reason", "resident_id", "residents", "tasks"}
	if got := slices.Sorted(maps.Keys(keys)); !slices.Equal(got, want) {
		t.Fatalf("prompt keys = %v\nwant          %v", got, want)
	}
	for _, name := range []string{"Ana", "Bruno", "Laundry"} {
		if strings.Contains(fake.LastRequest().User, name) {
			t.Errorf("prompt contains %q", name)
		}
	}
}

func TestTheExplanationSchemaIsClosedAndRequiresEveryField(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	if _, _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	schema := fake.LastRequest().Schema
	if schema["additionalProperties"] != false {
		t.Fatalf("root schema is open: %v", schema)
	}
	list := schema["properties"].(map[string]any)["explanations"].(map[string]any)
	item := list["items"].(map[string]any)
	if item["additionalProperties"] != false {
		t.Fatalf("item schema is open: %v", item)
	}
	wantKeys := []string{"resident_id", "headline_en_US", "headline_pt_BR", "detail_en_US", "detail_pt_BR"}
	if got := item["required"].([]string); !slices.Equal(got, wantKeys) {
		t.Fatalf("required = %v", got)
	}
	if got := slices.Sorted(maps.Keys(item["properties"].(map[string]any))); !slices.Equal(got, slices.Sorted(slices.Values(wantKeys))) {
		t.Fatalf("properties = %v", got)
	}
}

func TestTheExplanationSystemPromptIsFactsOnly(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	if _, _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	sys := fake.LastRequest().System
	for _, want := range []string{
		"second person", "only", "Brazilian Portuguese", "headline", "checkin", "drained",
		"do not mention other Residents", "120", "280", "whole day",
	} {
		if !strings.Contains(sys, want) {
			t.Errorf("system prompt lacks %q", want)
		}
	}
}
