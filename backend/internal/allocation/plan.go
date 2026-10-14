package allocation

import (
	"cmp"
	"slices"
)

// Baseline is the deterministic baseline allocator.
type Baseline struct{}

// Name is how a run record names this allocator.
func (Baseline) Name() string { return "baseline" }

// Plan implements Allocator.
func (Baseline) Plan(s State) (Result, error) { return Plan(s) }

// breaksRestriction reports which levels of Restriction giving the Task to the
// Resident would break. Plan and Check both use it so they cannot disagree.
func breaksRestriction(r Resident, t Task) (demand Demand, demandBroken, choreBroken bool) {
	for _, d := range t.Demands {
		if slices.Contains(r.DemandRestrictions, d) {
			demand, demandBroken = d, true
			break
		}
	}
	choreBroken = slices.Contains(r.ChoreRestrictions, t.ChoreID)
	return demand, demandBroken, choreBroken
}

// weekdayAllowed reports whether the Task may be done on the day. Plan and
// Check both use it so they cannot disagree.
func weekdayAllowed(t Task, day Date) bool {
	return len(t.AllowedWeekdays) == 0 || slices.Contains(t.AllowedWeekdays, day.Weekday())
}

// peopleNeeded is how many Residents the Task is given to: one, or two for a
// two-person Task. Plan and Check both use it so they cannot disagree.
func peopleNeeded(t Task) int {
	if t.People >= 2 {
		return 2
	}
	return 1
}

func restricted(r Resident, t Task) bool {
	_, d, c := breaksRestriction(r, t)
	return d || c
}

func energyOf(r Resident) int { return max(r.Energy, 0) }

// uniqueResidents and uniqueTasks keep the first occurrence of each ID.
func uniqueResidents(rs []Resident) []Resident {
	seen := make(map[string]bool, len(rs))
	var out []Resident
	for _, r := range rs {
		if !seen[r.ID] {
			seen[r.ID] = true
			out = append(out, r)
		}
	}
	return out
}

func uniqueTasks(ts []Task) []Task {
	seen := make(map[string]bool, len(ts))
	var out []Task
	for _, t := range ts {
		if !seen[t.ID] {
			seen[t.ID] = true
			out = append(out, t)
		}
	}
	return out
}

func deadlineToday(t Task, today Date) bool { return t.WindowEnd <= today }

func lateness(t Task, today Date) int { return max(int(today-t.WindowStart), 0) }

// Plan proposes a Day Plan: open Tasks sorted by hard deadline today, then
// Importance, then lateness, then TaskID, each given to the best fitting
// Resident; a two-person Task goes to the two best fitting Residents, each
// paying the full Effort. Fitting means not restricted and enough Energy left.
// Best is decided by compareCandidates: Preference (like, neutral, dislike),
// then among Residents who dislike the Chore the one who did it longest ago,
// then the most Energy left, then the lowest Resident ID. Preference only
// chooses among fitting Residents and never changes the Task order, so it
// cannot outrank Importance and never leaves a Task unassigned. Tasks that fit
// too few Residents stay in the pool. Output is sorted by TaskID then
// ResidentID and does not depend on the order of the input.
//
// A plan for a single Resident (a re-plan after a Check-in, or "get my tasks
// right away") has one candidate per Task, so Preference does not reorder their
// Tasks and no Preference reason appears.
func Plan(s State) (Result, error) {
	residents := uniqueResidents(s.Residents)
	slices.SortFunc(residents, func(a, b Resident) int { return cmp.Compare(a.ID, b.ID) })
	left := make([]int, len(residents))
	for i, r := range residents {
		left[i] = energyOf(r)
	}

	tasks := uniqueTasks(s.Tasks)
	// uniqueTasks keeps the first occurrence in input order; sort after so the
	// result only depends on the content when IDs are unique.
	slices.SortFunc(tasks, func(a, b Task) int {
		return cmp.Or(
			compareBool(deadlineToday(b, s.Today), deadlineToday(a, s.Today)),
			cmp.Compare(a.Importance.Rank(), b.Importance.Rank()),
			cmp.Compare(lateness(b, s.Today), lateness(a, s.Today)),
			cmp.Compare(a.ID, b.ID),
		)
	})

	var res Result
	for _, t := range tasks {
		switch {
		case t.Effort < 1:
			res.Pool = append(res.Pool, PoolEntry{t.ID, ReasonInvalidEffort})
			continue
		case !weekdayAllowed(t, s.Today):
			res.Pool = append(res.Pool, PoolEntry{t.ID, ReasonWeekdayNotAllowed})
			continue
		}
		// The fitting Residents, most Energy left first, ties by Resident ID
		// (residents is sorted by ID and the sort is stable).
		var fits []int
		allRestricted := len(residents) > 0
		for i, r := range residents {
			if restricted(r, t) {
				continue
			}
			allRestricted = false
			if left[i] >= t.Effort {
				fits = append(fits, i)
			}
		}
		// The pick the order by Energy alone would have made, to tell whether a
		// Preference changed it.
		byEnergy := slices.Clone(fits)
		slices.SortStableFunc(byEnergy, func(a, b int) int { return cmp.Compare(left[b], left[a]) })
		slices.SortStableFunc(fits, func(a, b int) int { return compareCandidates(residents[a], residents[b], left[a], left[b], t) })
		need := peopleNeeded(t)
		if len(fits) < need {
			why := ReasonNoEnergyLeft
			switch {
			case allRestricted:
				why = ReasonRestrictedForAll
			case need > 1:
				why = ReasonTwoPersonDeferred
			}
			res.Pool = append(res.Pool, PoolEntry{t.ID, why})
			continue
		}
		why := pickReason(residents, fits, byEnergy, need, t, s.Today)
		for _, i := range fits[:need] {
			left[i] -= t.Effort
			res.DayPlan.Assignments = append(res.DayPlan.Assignments,
				Assignment{t.ID, residents[i].ID, why})
		}
	}
	slices.SortFunc(res.DayPlan.Assignments, func(a, b Assignment) int {
		return cmp.Or(cmp.Compare(a.TaskID, b.TaskID), cmp.Compare(a.ResidentID, b.ResidentID))
	})
	slices.SortFunc(res.Pool, func(a, b PoolEntry) int { return cmp.Compare(a.TaskID, b.TaskID) })
	return res, nil
}

// compareCandidates orders two Residents who fit the Task, best first:
// the one who likes the Chore, then neutral, then the one who dislikes it;
// between two who dislike it, the one who did it longest ago (never done
// first); then the one with more Energy left. A full tie is left to the stable
// sort over Residents sorted by ID.
func compareCandidates(a, b Resident, leftA, leftB int, t Task) int {
	pa, pb := a.Preferences[t.ChoreID], b.Preferences[t.ChoreID]
	order := cmp.Compare(pa.rank(), pb.rank())
	if order == 0 && pa == Dislike {
		order = compareLastDone(a, b, t.ChoreID)
	}
	return cmp.Or(order, cmp.Compare(leftB, leftA))
}

// compareLastDone orders by the Date of the last Completion of the Chore,
// oldest first, with never done before any Date.
func compareLastDone(a, b Resident, choreID string) int {
	da, doneA := a.LastDone[choreID]
	db, doneB := b.LastDone[choreID]
	switch {
	case doneA && doneB:
		return cmp.Compare(da, db)
	case doneA:
		return 1
	case doneB:
		return -1
	}
	return 0
}

// pickReason says why the first need of fits took the Task. When they are the
// Residents the order by Energy alone would have chosen, it is the urgency
// reason. Otherwise a Preference or turn-taking decided it: liked when a chosen
// Resident likes the Chore and a passed-over one does not; else spared_dislike
// when a chosen Resident does not dislike it and a passed-over one does; else
// turn_taking.
func pickReason(residents []Resident, fits, byEnergy []int, need int, t Task, today Date) Reason {
	chosen, passed := fits[:need], fits[need:]
	if sameSet(chosen, byEnergy[:need]) {
		return assignmentReason(t, today)
	}
	pref := func(i int) Preference { return residents[i].Preferences[t.ChoreID] }
	if slices.ContainsFunc(chosen, func(i int) bool { return pref(i) == Like }) &&
		slices.ContainsFunc(passed, func(i int) bool { return pref(i) != Like }) {
		return ReasonLiked
	}
	if slices.ContainsFunc(chosen, func(i int) bool { return pref(i) != Dislike }) &&
		slices.ContainsFunc(passed, func(i int) bool { return pref(i) == Dislike }) {
		return ReasonSparedDislike
	}
	return ReasonTurnTaking
}

func sameSet(a, b []int) bool {
	for _, x := range a {
		if !slices.Contains(b, x) {
			return false
		}
	}
	return len(a) == len(b)
}

// assignmentReason names the sort key that placed the Task, strongest first.
func assignmentReason(t Task, today Date) Reason {
	switch {
	case deadlineToday(t, today):
		return ReasonDeadlineToday
	case t.Importance == Essential:
		return ReasonImportance
	case lateness(t, today) > 0:
		return ReasonLateness
	}
	return ReasonFitsEnergy
}

// compareBool orders false before true.
func compareBool(a, b bool) int {
	switch {
	case a == b:
		return 0
	case !a:
		return -1
	}
	return 1
}
