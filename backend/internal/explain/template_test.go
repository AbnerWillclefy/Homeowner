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

func tasks(n int, reason string, effort, people int) []explain.Task {
	out := make([]explain.Task, n)
	for i := range out {
		out[i] = explain.Task{Reason: reason, Category: "kitchen", Effort: effort, Importance: "normal", People: people}
	}
	return out
}

func TestTemplateSituations(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name  string
		facts explain.Facts
		want  explain.Situation
		// key phrases: headline en, headline pt, detail en, detail pt
		hEn, hPt, dEn, dPt string
	}{
		{"rest by Drained", explain.Facts{Energy: 0, Checkin: explain.CheckinDrained, Pool: []string{"no_energy_left", "refused"}},
			"rest", "Rest is the plan", "descansar", "2 open tasks wait for tomorrow", "2 tarefas em aberto ficam para amanhã"},
		{"rest by Energy 0 without a Check-in", explain.Facts{Energy: 0, Pool: []string{"refused"}},
			"rest", "Rest is the plan", "descansar", "No energy is set for today", "Não há energia definida para hoje"},
		{"rest with kept Tasks", explain.Facts{Energy: 0, Checkin: explain.CheckinDrained, Tasks: tasks(2, "taken", 2, 1)},
			"rest", "Rest is the plan", "descansar", "You still hold 2 tasks", "Você ainda tem 2 tarefas"},
		{"low", explain.Facts{Energy: 2, Checkin: explain.CheckinLow, Tasks: tasks(1, "importance", 1, 1)},
			"low", "lighter", "baixa", "important work", "tarefas importantes"},
		{"nothing fits with Tasks", explain.Facts{Energy: 3, Tasks: tasks(1, "fits_energy", 1, 1), Pool: []string{"no_energy_left", "no_energy_left"}},
			"nothing_fits", "Nothing more fits today", "Nada mais cabe hoje", "need more Energy than you have left", "pedem mais energia"},
		{"nothing fits without Tasks", explain.Facts{Energy: 3, Pool: []string{"no_energy_left"}},
			"nothing_fits", "Nothing fits your Energy today", "Nada cabe na energia que você tem hoje", "needs more Energy than you have left", "pede mais energia"},
		{"free", explain.Facts{Energy: 3, Pool: []string{"restricted_for_all"}},
			"free", "Nothing needs you today", "Nada precisa de você hoje", "1 open task still waits", "1 tarefa em aberto ainda espera"},
		{"free with an empty Home", explain.Facts{Energy: 3},
			"free", "Nothing needs you today", "Nada precisa de você hoje", "no work for you", "nenhum trabalho para você"},
		{"full", explain.Facts{Energy: 4, Tasks: tasks(2, "deadline_today", 2, 1), Pool: []string{"refused"}},
			"full", "full day", "Dia cheio", "work due today", "tarefas com prazo hoje"},
		{"shared", explain.Facts{Energy: 10, Tasks: append(tasks(1, "turn_taking", 1, 2), tasks(1, "liked", 1, 1)...)},
			"shared", "shared", "compartilhada", "taking turns", "revezamento"},
		{"light", explain.Facts{Energy: 10, Tasks: tasks(2, "lateness", 1, 1), Pool: []string{"weekday_not_allowed"}},
			"light", "light day", "Dia leve", "waited longest", "esperam há mais tempo"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := explain.SituationOf(tc.facts); got != tc.want {
				t.Fatalf("situation = %q, want %q", got, tc.want)
			}
			got := explain.Template(tc.facts)
			for _, c := range []struct{ field, text, want string }{
				{"headline en", got.Headline.EnUS, tc.hEn}, {"headline pt", got.Headline.PtBR, tc.hPt},
				{"detail en", got.Detail.EnUS, tc.dEn}, {"detail pt", got.Detail.PtBR, tc.dPt},
			} {
				if !strings.Contains(c.text, c.want) {
					t.Errorf("%s = %q, want it to contain %q", c.field, c.text, c.want)
				}
			}
			if !explain.ValidSummary(got) {
				t.Errorf("not valid: %+v", got)
			}
		})
	}
}

func TestLowHeadlineMentionsLowEnergy(t *testing.T) {
	t.Parallel()
	got := explain.Template(explain.Facts{Energy: 2, Checkin: explain.CheckinLow})
	if !strings.Contains(got.Headline.EnUS, "Low Energy") || !strings.Contains(got.Headline.PtBR, "energia baixa") {
		t.Fatalf("got %+v", got.Headline)
	}
}

// Facts that match two situations get the earlier one.
func TestSituationOrder(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		facts explain.Facts
		want  explain.Situation
	}{
		"low beats shared":           {explain.Facts{Energy: 6, Checkin: explain.CheckinLow, Tasks: tasks(1, "liked", 1, 2)}, "low"},
		"full beats shared":          {explain.Facts{Energy: 4, Tasks: tasks(1, "liked", 3, 2)}, "full"},
		"rest beats nothing fits":    {explain.Facts{Energy: 0, Checkin: explain.CheckinDrained, Pool: []string{"no_energy_left"}}, "rest"},
		"rest beats low":             {explain.Facts{Energy: 0, Checkin: explain.CheckinLow}, "rest"},
		"Drained beats Energy":       {explain.Facts{Energy: 3, Checkin: explain.CheckinDrained}, "rest"},
		"low beats nothing fits":     {explain.Facts{Energy: 1, Checkin: explain.CheckinLow, Pool: []string{"no_energy_left"}}, "low"},
		"nothing fits beats full":    {explain.Facts{Energy: 4, Tasks: tasks(2, "liked", 2, 1), Pool: []string{"no_energy_left"}}, "nothing_fits"},
		"free needs nobody waiting":  {explain.Facts{Energy: 4, Pool: []string{"refused", "no_energy_left"}}, "nothing_fits"},
		"normal has no situation":    {explain.Facts{Energy: 10, Checkin: explain.CheckinNormal, Tasks: tasks(1, "liked", 1, 1)}, "light"},
		"energized has no situation": {explain.Facts{Energy: 10, Checkin: explain.CheckinEnergized, Tasks: tasks(1, "liked", 1, 1)}, "light"},
		"three quarters is full":     {explain.Facts{Energy: 4, Tasks: tasks(1, "liked", 3, 1)}, "full"},
		"just under three quarters":  {explain.Facts{Energy: 5, Tasks: tasks(1, "liked", 3, 1)}, "light"},
	} {
		if got := explain.SituationOf(tc.facts); got != tc.want {
			t.Errorf("%s: %q, want %q", name, got, tc.want)
		}
	}
}

func TestDetailUsesAtMostTwoReasons(t *testing.T) {
	t.Parallel()
	f := explain.Facts{Energy: 40}
	for _, r := range []string{"deadline_today", "importance", "lateness", "turn_taking", "liked"} {
		f.Tasks = append(f.Tasks, explain.Task{Reason: r, People: 1})
	}
	got := explain.Template(f).Detail.EnUS
	// Ties go by priority: deadline_today, then importance.
	if !strings.Contains(got, "work due today") || !strings.Contains(got, "important work") {
		t.Fatalf("got %q", got)
	}
	for _, other := range []string{"waited longest", "taking turns", "work you like"} {
		if strings.Contains(got, other) {
			t.Errorf("%q mentions %q", got, other)
		}
	}
}

func TestDetailPrefersTheMostFrequentReasons(t *testing.T) {
	t.Parallel()
	f := explain.Facts{Energy: 40, Tasks: append(tasks(3, "liked", 1, 1), tasks(2, "swapped", 1, 1)...)}
	f.Tasks = append(f.Tasks, tasks(1, "deadline_today", 1, 1)...)
	got := explain.Template(f).Detail.EnUS
	if !strings.Contains(got, "work you like") || !strings.Contains(got, "swapped work") || strings.Contains(got, "due today") {
		t.Fatalf("got %q", got)
	}
}

func TestDetailMentionsThePoolOnlyWhenItIsNotEmpty(t *testing.T) {
	t.Parallel()
	f := explain.Facts{Energy: 10, Tasks: tasks(1, "liked", 1, 1)}
	if got := explain.Template(f).Detail; strings.Contains(got.EnUS, "open task") || strings.Contains(got.PtBR, "em aberto") {
		t.Fatalf("empty pool mentioned: %+v", got)
	}
	f.Pool = []string{"refused", "refused", "weekday_not_allowed"}
	if got := explain.Template(f).Detail; !strings.Contains(got.EnUS, "3 open tasks still wait") || !strings.Contains(got.PtBR, "3 tarefas em aberto ainda esperam") {
		t.Fatalf("pool not mentioned: %+v", got)
	}
}

// The same facts in another order read the same.
func TestTemplateDoesNotDependOnTheOrderOfTasks(t *testing.T) {
	t.Parallel()
	a := explain.Facts{Energy: 6, Tasks: []explain.Task{{Reason: "liked", People: 1}, {Reason: "importance", People: 1}, {Reason: "brand_new", People: 1}}, Pool: []string{"refused", "no_energy_left"}}
	b := explain.Facts{Energy: 6, Tasks: []explain.Task{{Reason: "brand_new", People: 1}, {Reason: "importance", People: 1}, {Reason: "liked", People: 1}}, Pool: []string{"no_energy_left", "refused"}}
	if explain.Template(a) != explain.Template(b) {
		t.Fatalf("%+v differs from %+v", explain.Template(a), explain.Template(b))
	}
}

func TestTemplateOfAnUnknownReasonIsGenericNeverEmpty(t *testing.T) {
	t.Parallel()
	got := explain.Template(explain.Facts{Energy: 30, Tasks: []explain.Task{{Reason: "brand_new", People: 1}}, Pool: []string{"also_new"}})
	if !explain.ValidSummary(got) {
		t.Fatalf("not valid: %+v", got)
	}
	for _, s := range []string{got.Headline.EnUS, got.Detail.EnUS, got.Headline.PtBR, got.Detail.PtBR} {
		if strings.Contains(s, "brand_new") || strings.Contains(s, "also_new") {
			t.Fatalf("raw id in %q", s)
		}
	}
}

var allReasons = []string{
	"deadline_today", "importance", "lateness", "turn_taking", "liked", "spared_dislike", "fits_energy", "taken", "swapped",
	"no_energy_left", "restricted_for_all", "two_person_deferred", "weekday_not_allowed", "invalid_effort", "refused", "added_after_plan",
	"brand_new",
}

// situationFacts has one Facts per situation, with the Task reason, the pool
// reason and the counts given.
func situationFacts(reason, poolReason string, n int) map[string]explain.Facts {
	pool := make([]string, n)
	for i := range pool {
		pool[i] = poolReason
	}
	noEnergy := append(append([]string{}, pool...), "no_energy_left")
	return map[string]explain.Facts{
		"rest":         {Energy: 0, Checkin: explain.CheckinDrained, Tasks: tasks(n, reason, 1, 1), Pool: pool},
		"rest nobase":  {Energy: 0, Tasks: tasks(n, reason, 1, 1), Pool: pool},
		"low":          {Energy: 3, Checkin: explain.CheckinLow, Tasks: append(tasks(n, reason, 1, 1), explain.Task{Reason: "importance"}), Pool: pool},
		"nothing fits": {Energy: 3, Tasks: tasks(n, reason, 1, 1), Pool: noEnergy},
		"nothing none": {Energy: 3, Pool: noEnergy},
		"free":         {Energy: 3, Pool: pool},
		"full":         {Energy: 3, Tasks: tasks(n, reason, 3, 1), Pool: pool},
		"shared":       {Energy: 300, Tasks: tasks(n, reason, 1, 2), Pool: pool},
		"light":        {Energy: 300, Tasks: tasks(n, reason, 1, 1), Pool: pool},
	}
}

// Every situation, every reason and several counts stay within the limits.
func TestEverySituationStaysWithinTheLimits(t *testing.T) {
	t.Parallel()
	for _, reason := range allReasons {
		for _, poolReason := range allReasons {
			for _, n := range []int{1, 2, 99} {
				for name, f := range situationFacts(reason, poolReason, n) {
					if got := explain.Template(f); !explain.ValidSummary(got) {
						t.Errorf("%s %s/%s x%d: not valid: %+v", name, reason, poolReason, n, got)
					}
				}
			}
		}
	}
	// Several different reasons at once, to reach the longest detail.
	f := explain.Facts{Energy: 300, Pool: make([]string, 99)}
	for _, r := range allReasons {
		f.Tasks = append(f.Tasks, explain.Task{Reason: r, People: 1})
	}
	if got := explain.Template(f); !explain.ValidSummary(got) {
		t.Errorf("mixed: %+v", got)
	}
}

func TestTemplateOfNothingIsValid(t *testing.T) {
	t.Parallel()
	if got := explain.Template(explain.Facts{}); !explain.ValidSummary(got) {
		t.Fatalf("%+v", got)
	}
}

// whyLines are the Task card "Why:" values in web/src/shared/i18n/catalogs
// (en-US.ts and pt-BR.ts), keys dayplan.assigned.reason.* and
// dayplan.pool.reason.*, lower case and without the final period. The day
// summary must not repeat them.
var whyLines = []string{
	"it is due today", "it matters most", "it has waited the longest", "it fits your energy",
	"no one has enough energy left today", "no one can do it", "it is not allowed on this day of the week",
	"it needs two people", "its effort is not valid", "it was added after today's plan was made",
	"it was refused, so it is back in the pool", "you took it from the pool", "you like this one",
	"spared a chore you dislike", "it is your turn",
	"vence hoje", "é a que mais importa", "é a que espera há mais tempo", "cabe na sua energia",
	"ninguém tem energia suficiente sobrando hoje", "ninguém pode fazer", "não é permitida neste dia da semana",
	"precisa de duas pessoas", "o esforço dela não é válido", "foi adicionada depois que o plano de hoje foi feito",
	"foi recusada, então voltou para as tarefas em aberto", "você pegou esta tarefa das em aberto",
	"você gosta desta", "poupado de uma tarefa de que você não gosta", "é a sua vez",
}

func TestTemplateDoesNotRepeatTheTaskCardReasons(t *testing.T) {
	t.Parallel()
	for _, reason := range allReasons {
		for name, f := range situationFacts(reason, reason, 2) {
			got := explain.Template(f)
			for _, text := range []string{got.Headline.EnUS, got.Detail.EnUS, got.Headline.PtBR, got.Detail.PtBR} {
				for _, why := range whyLines {
					if strings.Contains(strings.ToLower(text), why) {
						t.Errorf("%s/%s: %q repeats the card line %q", name, reason, text, why)
					}
				}
			}
		}
	}
}

func TestTemplateNamesNoChoreAndNoStreak(t *testing.T) {
	t.Parallel()
	for _, reason := range allReasons {
		for name, f := range situationFacts(reason, reason, 2) {
			got := explain.Template(f)
			for _, text := range []string{got.Headline.EnUS, got.Detail.EnUS, got.Headline.PtBR, got.Detail.PtBR} {
				if l := strings.ToLower(text); strings.Contains(l, "streak") || strings.Contains(l, "chore") || strings.Contains(l, "sequência") {
					t.Errorf("%s/%s: %q", name, reason, text)
				}
			}
		}
	}
}

func TestValidSummary(t *testing.T) {
	t.Parallel()
	ok := explain.Summary{
		Headline: explain.Texts{EnUS: "A light day.", PtBR: "Um dia leve."},
		Detail:   explain.Texts{EnUS: "Two tasks.", PtBR: "Duas tarefas."},
	}
	if !explain.ValidSummary(ok) {
		t.Fatal("a plain summary must be valid")
	}
	edit := func(f func(*explain.Summary)) explain.Summary { s := ok; f(&s); return s }
	for name, bad := range map[string]explain.Summary{
		"headline 121 en":  edit(func(s *explain.Summary) { s.Headline.EnUS = strings.Repeat("a", 121) }),
		"headline 121 pt":  edit(func(s *explain.Summary) { s.Headline.PtBR = strings.Repeat("ã", 121) }),
		"detail 281 en":    edit(func(s *explain.Summary) { s.Detail.EnUS = strings.Repeat("a", 281) }),
		"detail 281 pt":    edit(func(s *explain.Summary) { s.Detail.PtBR = strings.Repeat("ã", 281) }),
		"blank headline":   edit(func(s *explain.Summary) { s.Headline.EnUS = " " }),
		"blank detail":     edit(func(s *explain.Summary) { s.Detail.PtBR = "" }),
		"control headline": edit(func(s *explain.Summary) { s.Headline.PtBR = "a\nb" }),
		"markup detail":    edit(func(s *explain.Summary) { s.Detail.EnUS = "<b>x</b>" }),
		"link headline":    edit(func(s *explain.Summary) { s.Headline.EnUS = "see www.x.com" }),
		"link detail":      edit(func(s *explain.Summary) { s.Detail.PtBR = "https://x" }),
	} {
		if explain.ValidSummary(bad) {
			t.Errorf("%s: want invalid", name)
		}
	}
	atLimit := edit(func(s *explain.Summary) {
		s.Headline.PtBR = strings.Repeat("ã", 120)
		s.Detail.PtBR = strings.Repeat("ã", 280)
	})
	if !explain.ValidSummary(atLimit) {
		t.Error("texts at the limits (in runes) must be valid")
	}
}

func TestJoinedIsTheHeadlineThenTheDetail(t *testing.T) {
	t.Parallel()
	s := explain.Summary{Headline: explain.Texts{EnUS: "A.", PtBR: "B."}, Detail: explain.Texts{EnUS: "C.", PtBR: "D."}}
	if got := s.Joined(); got.EnUS != "A. C." || got.PtBR != "B. D." {
		t.Fatalf("%+v", got)
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
