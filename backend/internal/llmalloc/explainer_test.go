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
		{ResidentID: "r1", Facts: explain.Facts{Energy: 5, Pool: []string{"no_energy_left", "no_energy_left"},
			Tasks: []explain.Task{{Reason: "liked", Category: "kitchen", Effort: 2, Importance: "essential", People: 1}}}},
		{ResidentID: "r2", Facts: explain.Facts{Energy: 0, Tasks: []explain.Task{}, Pool: []string{}}},
	}
}

func explainWith(t *testing.T, answer string) (map[string]explain.Texts, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	return llmalloc.NewExplainer(fake).Explain(context.Background(), facts())
}

func entry(id, en, pt string) string {
	b, _ := json.Marshal(map[string]string{"resident_id": id, "en_US": en, "pt_BR": pt})
	return string(b)
}

func TestAGoodExplanationAnswerIsMappedByResident(t *testing.T) {
	t.Parallel()
	got, err := explainWith(t, `{"explanations": [`+entry("r1", "One task.", "Uma tarefa.")+`,`+entry("r2", "Rest.", "Descanse.")+`]}`)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]explain.Texts{
		"r1": {EnUS: "One task.", PtBR: "Uma tarefa."},
		"r2": {EnUS: "Rest.", PtBR: "Descanse."},
	}
	if !maps.Equal(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestWholeAnswerErrorsAreInvalidResponses(t *testing.T) {
	t.Parallel()
	for name, answer := range map[string]string{
		"not json":            `nope`,
		"unknown field":       `{"explanations": [], "extra": 1}`,
		"unknown entry field": `{"explanations": [{"resident_id": "r1", "en_US": "a", "pt_BR": "b", "mood": "x"}]}`,
		"missing list":        `{}`,
		"null list":           `{"explanations": null}`,
		"trailing data":       `{"explanations": []} {}`,
		"too large":           `{"explanations": [` + entry("r1", strings.Repeat("a", 70<<10), "b") + `]}`,
	} {
		if _, err := explainWith(t, answer); !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: want ErrInvalidResponse, got %v", name, err)
		}
	}
}

func TestBadEntriesAreDroppedAndTheRestKept(t *testing.T) {
	t.Parallel()
	good := entry("r2", "Rest.", "Descanse.")
	for name, bad := range map[string]string{
		"unknown resident": entry("zz", "a", "b"),
		"empty text":       entry("r1", "", "b"),
		"too long":         entry("r1", strings.Repeat("a", 401), "b"),
		"markup":           entry("r1", "<b>x</b>", "b"),
		"url":              entry("r1", "a", "see https://x.example"),
	} {
		got, err := explainWith(t, `{"explanations": [`+bad+`,`+good+`]}`)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if _, has := got["r1"]; has || len(got) != 1 || got["r2"].EnUS != "Rest." {
			t.Errorf("%s: got %+v", name, got)
		}
	}
}

func TestADuplicateResidentIsDroppedEntirely(t *testing.T) {
	t.Parallel()
	got, err := explainWith(t, `{"explanations": [`+entry("r1", "a", "b")+`,`+entry("r1", "c", "d")+`,`+entry("r2", "Rest.", "Descanse.")+`]}`)
	if err != nil {
		t.Fatal(err)
	}
	if _, has := got["r1"]; has || len(got) != 1 {
		t.Fatalf("got %+v", got)
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
	if _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestAnExplanationCallIsBoundedByTheResidentCount(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	e := llmalloc.NewExplainer(fake)
	if _, err := e.Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	two := fake.LastRequest().MaxTokens
	if _, err := e.Explain(context.Background(), append(facts(), facts()...)); err != nil {
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
	if _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	var input any
	if err := json.Unmarshal([]byte(fake.LastRequest().User), &input); err != nil {
		t.Fatal(err)
	}
	keys := map[string]bool{}
	collectKeys(input, keys)
	want := []string{"category", "effort", "energy", "facts", "importance", "people", "pool", "reason", "resident_id", "residents", "tasks"}
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
	if _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
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
	if got := item["required"].([]string); !slices.Equal(got, []string{"resident_id", "en_US", "pt_BR"}) {
		t.Fatalf("required = %v", got)
	}
}

func TestTheExplanationSystemPromptIsFactsOnly(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"explanations": []}`)
	if _, err := llmalloc.NewExplainer(fake).Explain(context.Background(), facts()); err != nil {
		t.Fatal(err)
	}
	sys := fake.LastRequest().System
	for _, want := range []string{"second person", "only", "Brazilian Portuguese"} {
		if !strings.Contains(sys, want) {
			t.Errorf("system prompt lacks %q", want)
		}
	}
}
