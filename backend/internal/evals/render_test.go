package evals

import (
	"bytes"
	"errors"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// fixedReport is a hand-built Report: the baseline places 3 of 4 tasks, one LLM
// run breaks Energy twice and the other returns no plan.
func fixedReport() Report {
	return Report{
		Model: "fake-model",
		Runs:  2,
		Days: []DayReport{{
			Name: "d1",
			Baseline: Outcome{Metrics: Metrics{
				ByKind: map[allocation.ViolationKind]int{}, TasksPlaced: 3, TasksTotal: 4, EffortPlaced: 6, EffortTotal: 8,
				FairnessOK: true, Spread: 0.25, Gini: 0.2, PrefFit: PrefFit{Assignments: 3, Liked: 1, Neutral: 2},
			}},
			LLM: []Outcome{
				{Metrics: Metrics{
					Violations: 2, ByKind: map[allocation.ViolationKind]int{allocation.OverEnergy: 2},
					TasksPlaced: 4, TasksTotal: 4, EffortPlaced: 8, EffortTotal: 8,
				}},
				{NoPlan: true, Err: errors.New("llm: invalid response")},
			},
		}},
	}
}

const goldenSummary = `Allocator evals  model: fake-model  days: 1  llm runs per day: 2

metric                      baseline  llm
runs                        1         2
no plan                     0         1
violations (mean per plan)  0.00      2.00
violations (worst plan)     0         2
  over_energy               0.00      2.00
tasks placed                75.0%     100.0%
effort placed               75.0%     100.0%
fairness spread             0.25      n/a
fairness gini               0.20      n/a
preference score            0.33      n/a
  liked/neutral/disliked    1/2/0     n/a
`

func TestRenderSummaryGolden(t *testing.T) {
	var buf bytes.Buffer
	if err := Render(&buf, fixedReport(), false); err != nil {
		t.Fatal(err)
	}
	if got := buf.String(); got != goldenSummary {
		t.Errorf("got:\n%s\nwant:\n%s", got, goldenSummary)
	}
}

func TestRenderVerboseAddsPerDayRows(t *testing.T) {
	var buf bytes.Buffer
	if err := Render(&buf, fixedReport(), true); err != nil {
		t.Fatal(err)
	}
	got := buf.String()
	if !strings.HasPrefix(got, goldenSummary) {
		t.Error("verbose output must start with the summary")
	}
	for _, want := range []string{"per day", "d1", "baseline", "llm #1", "llm #2", "no plan"} {
		if !strings.Contains(got, want) {
			t.Errorf("verbose output lacks %q:\n%s", want, got)
		}
	}
}

func TestRenderSkippedLLM(t *testing.T) {
	rep := fixedReport()
	rep.LLMSkipped = true
	rep.Days[0].LLM = nil
	var buf bytes.Buffer
	if err := Render(&buf, rep, false); err != nil {
		t.Fatal(err)
	}
	got := buf.String()
	if !strings.Contains(got, "llm column skipped") || !strings.Contains(got, "ANTHROPIC_API_KEY") {
		t.Errorf("want a note on why the llm column was skipped:\n%s", got)
	}
	if strings.Contains(got, "NaN") {
		t.Errorf("NaN in output:\n%s", got)
	}
}

func TestRenderNeverPrintsNaN(t *testing.T) {
	rep := Report{Runs: 1, Days: []DayReport{{Name: "empty",
		Baseline: Outcome{NoPlan: true, Err: errors.New("x")},
		LLM:      []Outcome{{NoPlan: true, Err: errors.New("x")}}}}}
	var buf bytes.Buffer
	if err := Render(&buf, rep, true); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(buf.String(), "NaN") {
		t.Errorf("NaN in output:\n%s", buf.String())
	}
}
