package evals

import (
	"math"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

func assign(task, resident string) allocation.Assignment {
	return allocation.Assignment{TaskID: task, ResidentID: resident, Reason: allocation.ReasonImportance}
}

func approx(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestMeasureFairness(t *testing.T) {
	tasks := []allocation.Task{
		{ID: "t1", ChoreID: "c1", Effort: 2, People: 1},
		{ID: "t2", ChoreID: "c2", Effort: 4, People: 1},
		{ID: "pair", ChoreID: "c3", Effort: 3, People: 2},
	}
	tests := []struct {
		name       string
		residents  []allocation.Resident
		plan       []allocation.Assignment
		wantOK     bool
		wantSpread float64
		wantGini   float64
	}{
		{
			name:      "equal load",
			residents: []allocation.Resident{{ID: "a", Energy: 4}, {ID: "b", Energy: 8}},
			plan:      []allocation.Assignment{assign("t1", "a"), assign("t2", "b")}, // 2/4 and 4/8
			wantOK:    true, wantSpread: 0, wantGini: 0,
		},
		{
			name:      "unequal load",
			residents: []allocation.Resident{{ID: "a", Energy: 4}, {ID: "b", Energy: 4}},
			plan:      []allocation.Assignment{assign("t2", "a")}, // 1.0 and 0
			wantOK:    true, wantSpread: 1, wantGini: 0.5,
		},
		{
			name:      "energy zero is skipped",
			residents: []allocation.Resident{{ID: "a", Energy: 4}, {ID: "drained", Energy: 0}},
			plan:      []allocation.Assignment{assign("t1", "a")},
			wantOK:    true, wantSpread: 0, wantGini: 0,
		},
		{
			name:      "two-person task costs both residents the full effort",
			residents: []allocation.Resident{{ID: "a", Energy: 3}, {ID: "b", Energy: 6}},
			plan:      []allocation.Assignment{assign("pair", "a"), assign("pair", "b")}, // 1.0 and 0.5
			wantOK:    true, wantSpread: 0.5, wantGini: 1.0 / 6,
		},
		{
			name:      "nobody has energy",
			residents: []allocation.Resident{{ID: "a", Energy: 0}},
			plan:      nil,
			wantOK:    false,
		},
		{
			name:      "empty plan is n/a, not perfect",
			residents: []allocation.Resident{{ID: "a", Energy: 4}, {ID: "b", Energy: 4}},
			plan:      nil,
			wantOK:    false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			st := allocation.State{Residents: tc.residents, Tasks: tasks}
			m := Measure(st, allocation.Result{DayPlan: allocation.DayPlan{Assignments: tc.plan}}, nil)
			if m.FairnessOK != tc.wantOK {
				t.Fatalf("FairnessOK = %v, want %v", m.FairnessOK, tc.wantOK)
			}
			if !tc.wantOK {
				return
			}
			if !approx(m.Spread, tc.wantSpread) || !approx(m.Gini, tc.wantGini) {
				t.Errorf("spread, gini = %v, %v; want %v, %v", m.Spread, m.Gini, tc.wantSpread, tc.wantGini)
			}
		})
	}
}

func TestMeasurePreferenceFit(t *testing.T) {
	st := allocation.State{
		Residents: []allocation.Resident{{
			ID: "a", Energy: 20,
			Preferences: map[string]allocation.Preference{"love": allocation.Like, "hate": allocation.Dislike},
		}},
		Tasks: []allocation.Task{
			{ID: "t1", ChoreID: "love", Effort: 1, People: 1},
			{ID: "t2", ChoreID: "hate", Effort: 1, People: 1},
			{ID: "t3", ChoreID: "meh", Effort: 1, People: 1}, // missing entry is neutral
			{ID: "t4", ChoreID: "love", Effort: 1, People: 1},
		},
	}
	res := allocation.Result{DayPlan: allocation.DayPlan{Assignments: []allocation.Assignment{
		assign("t1", "a"), assign("t4", "a"), assign("t2", "a"), assign("t3", "a"),
	}}}
	m := Measure(st, res, nil)
	if m.Liked != 2 || m.Neutral != 1 || m.Disliked != 1 {
		t.Fatalf("liked, neutral, disliked = %d, %d, %d; want 2, 1, 1", m.Liked, m.Neutral, m.Disliked)
	}
	if m.Assignments != 4 {
		t.Errorf("Assignments = %d, want 4", m.Assignments)
	}
	if score := float64(m.Liked-m.Disliked) / float64(m.Assignments); !approx(score, 0.25) {
		t.Errorf("score = %v, want 0.25", score)
	}
}

func TestMeasureCoverageAndViolations(t *testing.T) {
	st := allocation.State{
		Residents: []allocation.Resident{{ID: "a", Energy: 10}, {ID: "b", Energy: 10}},
		Tasks: []allocation.Task{
			{ID: "t1", Effort: 2, People: 1},
			{ID: "pair", Effort: 3, People: 2},
			{ID: "t3", Effort: 5, People: 1},
		},
	}
	res := allocation.Result{
		DayPlan: allocation.DayPlan{Assignments: []allocation.Assignment{assign("t1", "a"), assign("pair", "a"), assign("pair", "b"), assign("ghost", "a")}},
		Pool:    []allocation.PoolEntry{{TaskID: "t3", Reason: allocation.ReasonNoEnergyLeft}},
	}
	viol := []allocation.Violation{{Kind: allocation.UnknownTask}, {Kind: allocation.OverEnergy}, {Kind: allocation.OverEnergy}}
	m := Measure(st, res, viol)

	if m.TasksPlaced != 2 || m.TasksTotal != 3 {
		t.Errorf("tasks = %d of %d, want 2 of 3", m.TasksPlaced, m.TasksTotal)
	}
	// Effort counts a task once, however many residents hold it.
	if m.EffortPlaced != 5 || m.EffortTotal != 10 {
		t.Errorf("effort = %d of %d, want 5 of 10", m.EffortPlaced, m.EffortTotal)
	}
	if m.Violations != 3 || m.ByKind[allocation.OverEnergy] != 2 || m.ByKind[allocation.UnknownTask] != 1 {
		t.Errorf("violations = %d %v", m.Violations, m.ByKind)
	}
	if m.Pool[allocation.ReasonNoEnergyLeft] != 1 {
		t.Errorf("pool = %v", m.Pool)
	}
	// The unknown task "ghost" is not counted anywhere else.
	if m.Assignments != 3 {
		t.Errorf("Assignments = %d, want 3 (known pairs only)", m.Assignments)
	}
}
