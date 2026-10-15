package evals

import (
	"context"
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
}

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
	rep := Report{Model: cfg.Model, Runs: runs, LLMSkipped: cfg.Proposer == nil}
	for _, d := range days {
		dr := DayReport{Name: d.Name}
		res, err := allocation.Baseline{}.Plan(d.State)
		dr.Baseline = outcome(d.State, res, err)
		if cfg.Proposer != nil {
			for range runs {
				dr.LLM = append(dr.LLM, proposeOnce(ctx, cfg, d.State))
			}
		}
		rep.Days = append(rep.Days, dr)
	}
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

	// Preference counts are pooled over every assignment of every plan.
	Assignments              int
	Liked, Neutral, Disliked int
}

// PreferenceScore is like +1, neutral 0, dislike -1, averaged per assignment;
// ok is false when there were no assignments.
func (s Summary) PreferenceScore() (score float64, ok bool) {
	if s.Assignments == 0 {
		return 0, false
	}
	return float64(s.Liked-s.Disliked) / float64(s.Assignments), true
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
		s.Assignments += m.Assignments
		s.Liked += m.Liked
		s.Neutral += m.Neutral
		s.Disliked += m.Disliked
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
