package explain_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
)

func one(reason string) explain.Facts {
	return explain.Facts{Energy: 4, Tasks: []explain.Task{{Reason: reason, Category: "kitchen", Effort: 2, Importance: "normal", People: 1}}}
}

func TestTemplateHasASentenceForEveryAssignedReason(t *testing.T) {
	t.Parallel()
	for reason, want := range map[string][2]string{
		"deadline_today": {"due today", "vence hoje"},
		"importance":     {"important", "importante"},
		"lateness":       {"waiting", "esperando"},
		"fits_energy":    {"fits your energy", "cabe na sua energia"},
		"liked":          {"you like", "você gosta"},
		"spared_dislike": {"dislike", "gosta ainda menos"},
		"turn_taking":    {"your turn", "sua vez"},
		"taken":          {"you took", "você pegou"},
		"swapped":        {"swap", "troca"},
	} {
		got := explain.Template(one(reason))
		if !strings.Contains(got.EnUS, want[0]) || !strings.Contains(got.PtBR, want[1]) {
			t.Errorf("%s: got %+v, want %q and %q", reason, got, want[0], want[1])
		}
	}
}

func TestTemplateHasASentenceForEveryPoolReason(t *testing.T) {
	t.Parallel()
	for reason, want := range map[string][2]string{
		"no_energy_left":      {"energy", "energia"},
		"restricted_for_all":  {"restriction", "restrição"},
		"two_person_deferred": {"two people", "duas pessoas"},
		"weekday_not_allowed": {"weekday", "dia da semana"},
		"invalid_effort":      {"effort", "esforço"},
		"refused":             {"refused", "recusad"},
		"added_after_plan":    {"after the plan", "depois do plano"},
	} {
		got := explain.Template(explain.Facts{Energy: 4, Pool: []string{reason, reason}})
		if !strings.Contains(got.EnUS, want[0]) || !strings.Contains(got.PtBR, want[1]) || !strings.Contains(got.EnUS, "2") {
			t.Errorf("%s: got %+v, want %q and %q and a count", reason, got, want[0], want[1])
		}
	}
}

func TestTemplateGroupsTasksByReasonAndCounts(t *testing.T) {
	t.Parallel()
	f := explain.Facts{Energy: 6, Tasks: []explain.Task{{Reason: "importance", People: 1}, {Reason: "importance", People: 1}, {Reason: "liked", People: 1}}}
	got := explain.Template(f)
	if !strings.Contains(got.EnUS, "2 tasks") || strings.Count(got.EnUS, "important") != 1 {
		t.Fatalf("got %q", got.EnUS)
	}
}

// The same facts in another order read the same, so the template does not
// depend on how the Tasks happened to be listed.
func TestTemplateDoesNotDependOnTheOrderOfTasks(t *testing.T) {
	t.Parallel()
	a := explain.Facts{Energy: 6, Tasks: []explain.Task{{Reason: "liked", People: 1}, {Reason: "importance", People: 1}, {Reason: "brand_new", People: 1}}, Pool: []string{"refused", "no_energy_left"}}
	b := explain.Facts{Energy: 6, Tasks: []explain.Task{{Reason: "brand_new", People: 1}, {Reason: "importance", People: 1}, {Reason: "liked", People: 1}}, Pool: []string{"no_energy_left", "refused"}}
	if explain.Template(a) != explain.Template(b) {
		t.Fatalf("%+v differs from %+v", explain.Template(a), explain.Template(b))
	}
}

func TestTemplateSaysWhenATaskIsShared(t *testing.T) {
	t.Parallel()
	f := one("fits_energy")
	f.Tasks[0].People = 2
	got := explain.Template(f)
	if !strings.Contains(got.EnUS, "shared") || !strings.Contains(got.PtBR, "compartilhad") {
		t.Fatalf("got %+v", got)
	}
}

func TestTemplateForAnEmptyPlan(t *testing.T) {
	t.Parallel()
	drained := explain.Template(explain.Facts{Energy: 0, Pool: []string{"no_energy_left"}})
	if !strings.Contains(drained.EnUS, "no energy") || !strings.Contains(drained.PtBR, "sem energia") {
		t.Fatalf("drained: %+v", drained)
	}
	nothing := explain.Template(explain.Facts{Energy: 3})
	if !strings.Contains(nothing.EnUS, "no tasks") || !strings.Contains(nothing.PtBR, "nenhuma tarefa") {
		t.Fatalf("nothing: %+v", nothing)
	}
}

func TestTemplateOfAnUnknownReasonIsGenericNeverEmpty(t *testing.T) {
	t.Parallel()
	got := explain.Template(explain.Facts{Energy: 3, Tasks: []explain.Task{{Reason: "brand_new", People: 1}}, Pool: []string{"also_new"}})
	if !explain.Valid(got) || strings.Contains(got.EnUS, "brand_new") || strings.Contains(got.EnUS, "also_new") {
		t.Fatalf("got %+v", got)
	}
}

func TestTemplateIsAlwaysValid(t *testing.T) {
	t.Parallel()
	for _, f := range []explain.Facts{{}, {Energy: 5}, one("importance"), {Pool: []string{"refused"}}} {
		if got := explain.Template(f); !explain.Valid(got) {
			t.Errorf("%+v: template %+v is not valid", f, got)
		}
	}
}

// Drift guard: a reason added to allocation or dayplan without a sentence here
// fails this test instead of producing generic text.
func TestEveryRecordedReasonIsHandled(t *testing.T) {
	t.Parallel()
	reasons := []string{dayplan.ReasonTaken, dayplan.ReasonSwapped, dayplan.ReasonRefused, dayplan.ReasonAddedAfterPlan}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "../allocation/types.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	ast.Inspect(file, func(n ast.Node) bool {
		spec, ok := n.(*ast.ValueSpec)
		if !ok || spec.Type == nil || len(spec.Values) != 1 {
			return true
		}
		if id, ok := spec.Type.(*ast.Ident); ok && id.Name == "Reason" {
			s, err := strconv.Unquote(spec.Values[0].(*ast.BasicLit).Value)
			if err != nil {
				t.Fatal(err)
			}
			reasons = append(reasons, s)
		}
		return true
	})
	if len(reasons) < 16 {
		t.Fatalf("found only %d reasons: %v", len(reasons), reasons)
	}
	for _, r := range reasons {
		if !explain.Known(r) {
			t.Errorf("reason %q has no explanation sentence", r)
		}
	}
}
