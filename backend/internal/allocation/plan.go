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

// WeekdayAllowed reports whether the Task may be done on the day. Plan, Check
// and the LLM allocator's pre-filter use it so they cannot disagree.
func WeekdayAllowed(t Task, day Date) bool {
	return len(t.AllowedWeekdays) == 0 || slices.Contains(t.AllowedWeekdays, day.Weekday())
}

// PeopleNeeded is how many Residents the Task is given to: one, or two for a
// two-person Task. Plan, Check and the LLM allocator's pre-filter use it so
// they cannot disagree.
func PeopleNeeded(t Task) int {
	if t.People >= 2 {
		return 2
	}
	return 1
}

// Eligible reports whether the Resident may be given the Task on the day by
// the hard rules that do not depend on Energy: the Task's weekday and the
// Resident's Restrictions. It reuses the helpers Plan and Check use, so the
// three cannot disagree.
func Eligible(r Resident, t Task, day Date) bool {
	return WeekdayAllowed(t, day) && !restricted(r, t)
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
		case !WeekdayAllowed(t, s.Today):
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
		slices.SortStableFunc(fits, func(a, b int) int { return compareCandidates(residents[a], residents[b], left[a], left[b], t) })
		need := PeopleNeeded(t)
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
		why := assignmentReason(t, s.Today)
		if r, ok := decidingReason(residents, left, fits[:need], fits[need:], t); ok {
			why = r
		}
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
