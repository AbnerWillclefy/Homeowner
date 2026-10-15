// Package evals compares the LLM allocator with the baseline on a dataset of
// synthetic days (ADR 0004). It works at the Allocation seam: per day it builds
// an allocation.State, asks each allocator for a Result and measures it, with
// allocation.Check as the only judge of violations. It never touches Postgres,
// dayplan or HTTP, and it does not wire in the production fallback: a raw LLM
// proposal that breaks a rule is counted, not hidden.
//
// The evals are a report, not a gate, and they cost money, so they run only
// through cmd/evals, never inside go test:
//
//	cd backend && ANTHROPIC_API_KEY=... go run ./cmd/evals [-dir path] [-runs 3] [-model name] [-timeout 15s] [-baseline-only] [-v] [-yes]
//
// With no ANTHROPIC_API_KEY the command prints the baseline column only.
package evals

import (
	"sort"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// Metrics describes one Result on one day. Every ratio is left to the reader
// (see the OK flags) so a day with nothing to divide never produces NaN.
type Metrics struct {
	// Violations is the number of rules Check found broken, ByKind by kind.
	Violations int
	ByKind     map[allocation.ViolationKind]int

	// Coverage, so an empty plan cannot look perfect. A Task counts once however
	// many Residents hold it.
	TasksPlaced, TasksTotal   int
	EffortPlaced, EffortTotal int
	// Pool counts the pool entries by reason.
	Pool map[allocation.Reason]int

	// Fairness: each Resident with Energy has a load share, the Effort they were
	// given divided by their Energy. Spread is the largest share minus the
	// smallest and Gini the Gini coefficient of the shares. FairnessOK is false
	// when nobody had Energy or nothing was assigned.
	Spread, Gini float64
	FairnessOK   bool

	// Preference fit, over assignments to a known Task and Resident.
	Assignments              int
	Liked, Neutral, Disliked int
}

// PreferenceScore is the mean of like +1, neutral 0, dislike -1 per
// assignment; ok is false when there are no assignments.
func (m Metrics) PreferenceScore() (score float64, ok bool) {
	if m.Assignments == 0 {
		return 0, false
	}
	return float64(m.Liked-m.Disliked) / float64(m.Assignments), true
}

// Measure computes the Metrics of res on st. violations come from
// allocation.Check; they are counted as given.
func Measure(st allocation.State, res allocation.Result, violations []allocation.Violation) Metrics {
	m := Metrics{
		Violations: len(violations),
		ByKind:     map[allocation.ViolationKind]int{},
		Pool:       map[allocation.Reason]int{},
		TasksTotal: len(st.Tasks),
	}
	for _, v := range violations {
		m.ByKind[v.Kind]++
	}
	for _, p := range res.Pool {
		m.Pool[p.Reason]++
	}

	tasks := map[string]allocation.Task{}
	for _, t := range st.Tasks {
		tasks[t.ID] = t
		m.EffortTotal += t.Effort
	}
	residents := map[string]allocation.Resident{}
	for _, r := range st.Residents {
		residents[r.ID] = r
	}

	load := map[string]int{}
	placed := map[string]bool{}
	for _, a := range res.DayPlan.Assignments {
		t, okT := tasks[a.TaskID]
		r, okR := residents[a.ResidentID]
		if !okT || !okR {
			continue
		}
		if !placed[t.ID] {
			placed[t.ID] = true
			m.TasksPlaced++
			m.EffortPlaced += t.Effort
		}
		// A two-person Task costs each of its Residents the full Effort.
		load[r.ID] += t.Effort
		m.Assignments++
		switch r.Preferences[t.ChoreID] {
		case allocation.Like:
			m.Liked++
		case allocation.Dislike:
			m.Disliked++
		default:
			m.Neutral++
		}
	}

	var shares []float64
	total := 0.0
	for _, r := range st.Residents {
		if r.Energy <= 0 {
			continue
		}
		s := float64(load[r.ID]) / float64(r.Energy)
		shares = append(shares, s)
		total += s
	}
	if len(shares) > 0 && total > 0 {
		m.FairnessOK = true
		sort.Float64s(shares)
		m.Spread = shares[len(shares)-1] - shares[0]
		m.Gini = gini(shares, total)
	}
	return m
}

// gini is the Gini coefficient of non-negative shares with a positive sum.
func gini(shares []float64, total float64) float64 {
	n := float64(len(shares))
	diff := 0.0
	for _, a := range shares {
		for _, b := range shares {
			if a > b {
				diff += a - b
			} else {
				diff += b - a
			}
		}
	}
	return diff / (2 * n * total)
}
