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

	// PrefFit is the Preference fit, over assignments to a known Task and
	// Resident.
	PrefFit
}

// PrefFit counts assignments by how the Resident feels about the Chore.
type PrefFit struct {
	Assignments              int
	Liked, Neutral, Disliked int
}

// Score is the mean of like +1, neutral 0, dislike -1 per assignment; ok is
// false when there are no assignments.
func (p PrefFit) Score() (score float64, ok bool) {
	if p.Assignments == 0 {
		return 0, false
	}
	return float64(p.Liked-p.Disliked) / float64(p.Assignments), true
}

func (p *PrefFit) add(o PrefFit) {
	p.Assignments += o.Assignments
	p.Liked += o.Liked
	p.Neutral += o.Neutral
	p.Disliked += o.Disliked
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
