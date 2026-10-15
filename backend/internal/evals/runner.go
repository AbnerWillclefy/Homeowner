package evals

import (
	"context"
	"sync"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// Proposer is the LLM allocator as the evals reach it: llmalloc.Allocator
// satisfies it. Its Result is not yet refereed; Run referees it.
type Proposer interface {
	Propose(ctx context.Context, st allocation.State) (allocation.Result, error)
}

// Config says how to run the evals.
type Config struct {
	// Proposer is the LLM allocator. Nil skips the LLM column.
	Proposer Proposer
	// Runs is how many times each day is proposed by the LLM (it is not
	// deterministic). Below 1 it is 1.
	Runs int
	// Timeout bounds one model call. Zero means no limit beyond ctx.
	Timeout time.Duration
	// Model is only printed in the header.
	Model string
	// Concurrency is how many model calls run at once, to stay under the API
	// rate limit. Below 1 it is DefaultConcurrency.
	Concurrency int
}

// DefaultConcurrency is the number of model calls in flight when
// Config.Concurrency is not set.
const DefaultConcurrency = 4

// Outcome is one allocator run on one day. NoPlan means the allocator returned
// an error (a timeout, an invalid answer): no Day Plan at all, which is not the
// same as a plan with violations. Err says why.
type Outcome struct {
	NoPlan  bool
	Err     error
	Metrics Metrics
}

// DayReport holds the outcomes for one day. The baseline is deterministic, so
// it runs once; the LLM runs Config.Runs times.
type DayReport struct {
	Name     string
	Baseline Outcome
	LLM      []Outcome
}

// Report is everything a run measured, and all the renderer needs.
type Report struct {
	Model      string
	Runs       int
	LLMSkipped bool
	Days       []DayReport
}

// Run plans every day with the baseline and, when cfg.Proposer is set, with
// the LLM allocator. Every Result is judged by allocation.Check as it is: a
// raw LLM proposal is never replaced by the baseline.
func Run(ctx context.Context, days []Day, cfg Config) Report {
	runs := max(cfg.Runs, 1)
	rep := Report{Model: cfg.Model, Runs: runs, LLMSkipped: cfg.Proposer == nil, Days: make([]DayReport, len(days))}
	for i, d := range days {
		res, err := allocation.Baseline{}.Plan(d.State)
		rep.Days[i] = DayReport{Name: d.Name, Baseline: outcome(d.State, res, err)}
		if cfg.Proposer != nil {
			rep.Days[i].LLM = make([]Outcome, runs)
		}
	}
	if cfg.Proposer == nil {
		return rep
	}

	// The model calls are independent. A bounded pool runs them, and each writes
	// its own pre-sized slot, so the order is fixed and no lock is needed.
	limit := cfg.Concurrency
	if limit < 1 {
		limit = DefaultConcurrency
	}
	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for i, d := range days {
		for j := range runs {
			sem <- struct{}{}
			wg.Add(1)
			go func() {
				defer func() { <-sem; wg.Done() }()
				rep.Days[i].LLM[j] = proposeOnce(ctx, cfg, d.State)
			}()
		}
	}
	wg.Wait()
	return rep
}

func proposeOnce(ctx context.Context, cfg Config, st allocation.State) Outcome {
	if cfg.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, cfg.Timeout)
		defer cancel()
	}
	res, err := cfg.Proposer.Propose(ctx, st)
	return outcome(st, res, err)
}

func outcome(st allocation.State, res allocation.Result, err error) Outcome {
	if err != nil {
		return Outcome{NoPlan: true, Err: err}
	}
	return Outcome{Metrics: Measure(st, res, allocation.Check(res.DayPlan, st))}
}

// Summary aggregates the Outcomes of one allocator over every day and run.
// Ratios and means are over the runs that produced a plan; the counts next to
// them say how many that was, so the renderer can print n/a instead of NaN.
type Summary struct {
	Runs, NoPlan, Plans int

	ViolationsMean  float64
	ViolationsWorst int
	// ByKind is the mean number of violations of each kind per plan.
	ByKind map[allocation.ViolationKind]float64

	TasksPlacedRatio, EffortPlacedRatio float64

	// FairnessRuns is how many plans had a defined fairness; the means are over
	// those.
	FairnessRuns         int
	SpreadMean, GiniMean float64

	// PrefFit is pooled over every assignment of every plan.
	PrefFit
}

// Summarize aggregates outcomes.
func Summarize(outcomes []Outcome) Summary {
	s := Summary{Runs: len(outcomes), ByKind: map[allocation.ViolationKind]float64{}}
	var violations, tasksPlaced, tasksTotal, effortPlaced, effortTotal int
	var spread, gini float64
	for _, o := range outcomes {
		if o.NoPlan {
			s.NoPlan++
			continue
		}
		m := o.Metrics
		s.Plans++
		violations += m.Violations
		s.ViolationsWorst = max(s.ViolationsWorst, m.Violations)
		for k, n := range m.ByKind {
			s.ByKind[k] += float64(n)
		}
		tasksPlaced += m.TasksPlaced
		tasksTotal += m.TasksTotal
		effortPlaced += m.EffortPlaced
		effortTotal += m.EffortTotal
		if m.FairnessOK {
			s.FairnessRuns++
			spread += m.Spread
			gini += m.Gini
		}
		s.PrefFit.add(m.PrefFit)
	}
	if s.Plans > 0 {
		n := float64(s.Plans)
		s.ViolationsMean = float64(violations) / n
		for k := range s.ByKind {
			s.ByKind[k] /= n
		}
		s.TasksPlacedRatio = ratio(tasksPlaced, tasksTotal)
		s.EffortPlacedRatio = ratio(effortPlaced, effortTotal)
	}
	if s.FairnessRuns > 0 {
		s.SpreadMean = spread / float64(s.FairnessRuns)
		s.GiniMean = gini / float64(s.FairnessRuns)
	}
	return s
}

func ratio(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}
