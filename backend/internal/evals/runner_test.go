package evals

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

func oneDay() []Day {
	return []Day{{Name: "one", State: allocation.State{
		Today:     allocation.NewDate(2026, 3, 2),
		Residents: []allocation.Resident{{ID: "r1", Energy: 3}},
		Tasks: []allocation.Task{
			{ID: "t1", ChoreID: "c1", Effort: 2, Importance: allocation.Normal, People: 1},
			{ID: "t2", ChoreID: "c2", Effort: 2, Importance: allocation.Normal, People: 1},
		},
	}}}
}

func runWith(t *testing.T, fake *llmalloc.FakeClient, timeout time.Duration, runs int) Report {
	t.Helper()
	return Run(context.Background(), oneDay(), Config{Proposer: llmalloc.New(fake), Runs: runs, Timeout: timeout, Model: "fake"})
}

func TestRunValidAnswer(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"assignments":[{"task_id":"t1","resident_id":"r1","reason":"importance"}],"pool":[{"task_id":"t2","reason":"no_energy_left"}]}`)
	rep := runWith(t, fake, time.Second, 3)

	if fake.Calls() != 3 {
		t.Errorf("model calls = %d, want 3 (one per run)", fake.Calls())
	}
	d := rep.Days[0]
	if d.Baseline.NoPlan || d.Baseline.Metrics.Violations != 0 || d.Baseline.Metrics.TasksPlaced != 1 {
		t.Errorf("baseline = %+v", d.Baseline)
	}
	if len(d.LLM) != 3 {
		t.Fatalf("llm outcomes = %d, want 3", len(d.LLM))
	}
	for _, o := range d.LLM {
		if o.NoPlan || o.Metrics.Violations != 0 || o.Metrics.TasksPlaced != 1 {
			t.Errorf("llm outcome = %+v", o)
		}
	}
	if rep.LLMSkipped {
		t.Error("LLMSkipped = true")
	}
}

func TestRunCountsAViolationInsteadOfHidingIt(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	// 4 effort on 3 energy: the referee must flag it and no fallback may replace it.
	fake.Answer(`{"assignments":[{"task_id":"t1","resident_id":"r1","reason":"importance"},{"task_id":"t2","resident_id":"r1","reason":"importance"}],"pool":[]}`)
	rep := runWith(t, fake, time.Second, 1)

	o := rep.Days[0].LLM[0]
	if o.NoPlan {
		t.Fatal("a rule-breaking plan is a plan, not a missing plan")
	}
	if o.Metrics.Violations != 1 || o.Metrics.ByKind[allocation.OverEnergy] != 1 {
		t.Errorf("metrics = %+v, want one over_energy", o.Metrics)
	}
	if o.Metrics.TasksPlaced != 2 {
		t.Errorf("TasksPlaced = %d: the raw proposal must be measured, not the baseline", o.Metrics.TasksPlaced)
	}
}

func TestRunCountsNoPlan(t *testing.T) {
	tests := []struct {
		name  string
		setup func(*llmalloc.FakeClient)
	}{
		{"client error", func(f *llmalloc.FakeClient) { f.Fail(errors.New("boom")) }},
		{"invalid answer", func(f *llmalloc.FakeClient) { f.Answer(`{"assignments": "no"}`) }},
		{"unknown reason", func(f *llmalloc.FakeClient) {
			f.Answer(`{"assignments":[{"task_id":"t1","resident_id":"r1","reason":"vibes"}],"pool":[]}`)
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fake := llmalloc.NewFakeClient()
			tc.setup(fake)
			o := runWith(t, fake, time.Second, 1).Days[0].LLM[0]
			if !o.NoPlan || o.Err == nil {
				t.Errorf("outcome = %+v, want NoPlan with an error", o)
			}
		})
	}
}

func TestRunBlockedClientHitsTheTimeout(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	fake.Block()
	start := time.Now()
	rep := runWith(t, fake, 20*time.Millisecond, 1)

	o := rep.Days[0].LLM[0]
	if !o.NoPlan || !errors.Is(o.Err, context.DeadlineExceeded) {
		t.Errorf("outcome = %+v, want NoPlan with a deadline error", o)
	}
	if time.Since(start) > 2*time.Second {
		t.Error("the per-call timeout did not apply")
	}
}

func TestRunWithoutProposerSkipsTheLLM(t *testing.T) {
	rep := Run(context.Background(), oneDay(), Config{})
	if !rep.LLMSkipped || len(rep.Days[0].LLM) != 0 {
		t.Errorf("report = %+v, want the LLM skipped", rep)
	}
	if rep.Days[0].Baseline.Metrics.TasksPlaced != 1 {
		t.Errorf("baseline did not run: %+v", rep.Days[0].Baseline)
	}
}

func TestSummarize(t *testing.T) {
	outcomes := []Outcome{
		{Metrics: Metrics{Violations: 2, ByKind: map[allocation.ViolationKind]int{allocation.OverEnergy: 2},
			TasksPlaced: 1, TasksTotal: 2, EffortPlaced: 2, EffortTotal: 4,
			FairnessOK: true, Spread: 0.5, Gini: 0.2, PrefFit: PrefFit{Assignments: 2, Liked: 1, Disliked: 0, Neutral: 1}}},
		{Metrics: Metrics{Violations: 0, ByKind: map[allocation.ViolationKind]int{},
			TasksPlaced: 2, TasksTotal: 2, EffortPlaced: 4, EffortTotal: 4,
			FairnessOK: true, Spread: 0.1, Gini: 0.4, PrefFit: PrefFit{Assignments: 2, Liked: 0, Disliked: 1, Neutral: 1}}},
		{NoPlan: true, Err: errors.New("x")},
	}
	s := Summarize(outcomes)
	if s.Runs != 3 || s.NoPlan != 1 || s.Plans != 2 {
		t.Errorf("counts = %+v", s)
	}
	if !approx(s.ViolationsMean, 1) || s.ViolationsWorst != 2 {
		t.Errorf("violations mean, worst = %v, %v; want 1, 2", s.ViolationsMean, s.ViolationsWorst)
	}
	if !approx(s.ByKind[allocation.OverEnergy], 1) {
		t.Errorf("by kind = %v", s.ByKind)
	}
	if !approx(s.TasksPlacedRatio, 0.75) || !approx(s.EffortPlacedRatio, 0.75) {
		t.Errorf("coverage = %v, %v; want 0.75", s.TasksPlacedRatio, s.EffortPlacedRatio)
	}
	if s.FairnessRuns != 2 || !approx(s.SpreadMean, 0.3) || !approx(s.GiniMean, 0.3) {
		t.Errorf("fairness = %d %v %v", s.FairnessRuns, s.SpreadMean, s.GiniMean)
	}
	if s.Assignments != 4 || s.Liked != 1 || s.Neutral != 2 || s.Disliked != 1 {
		t.Errorf("preference counts = %+v", s)
	}
}

// gate is a Proposer that records the most calls in flight at once.
type gate struct {
	mu        sync.Mutex
	inFlight  int
	maxFlight int
}

func (g *gate) Propose(ctx context.Context, st allocation.State) (allocation.Result, *llmalloc.Usage, bool, error) {
	g.mu.Lock()
	g.inFlight++
	g.maxFlight = max(g.maxFlight, g.inFlight)
	g.mu.Unlock()
	time.Sleep(10 * time.Millisecond)
	g.mu.Lock()
	g.inFlight--
	g.mu.Unlock()
	return allocation.Result{}, nil, true, errors.New("no plan")
}

func TestRunBoundsConcurrentCallsAndKeepsEverySlot(t *testing.T) {
	days := append(oneDay(), oneDay()...)
	g := &gate{}
	rep := Run(context.Background(), days, Config{Proposer: g, Runs: 4, Concurrency: 2})

	if g.maxFlight > 2 || g.maxFlight < 2 {
		t.Errorf("max calls in flight = %d, want 2", g.maxFlight)
	}
	for _, d := range rep.Days {
		if len(d.LLM) != 4 {
			t.Fatalf("llm outcomes = %d, want 4", len(d.LLM))
		}
		for _, o := range d.LLM {
			if !o.NoPlan {
				t.Errorf("slot not filled: %+v", o)
			}
		}
	}
}

func TestSummarizeEmptyIsNotNaN(t *testing.T) {
	s := Summarize([]Outcome{{NoPlan: true}})
	if s.Plans != 0 || s.FairnessRuns != 0 || s.Assignments != 0 {
		t.Errorf("summary = %+v", s)
	}
}
