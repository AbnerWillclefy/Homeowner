package allocation

import (
	"cmp"
	"fmt"
	"slices"
)

// Check returns every rule the Day Plan breaks in the state, not just the
// first. It is the referee for any allocator. The result is sorted by kind,
// TaskID, ResidentID and level so it is stable.
//
// Over-energy is reported once per Resident (TaskID empty), because the rule
// is that the sum of a Resident's Efforts stays within their Energy.
//
// A one-person Task appearing in more than one assignment is a DuplicateTask.
// A two-person Task legitimately appears once per Resident: it is a
// WrongResidentCount unless exactly two distinct Residents are named (known or
// not), and a DuplicateTask if one of those pairs repeats. A Task absent from
// the plan is in the pool, never a violation.
func Check(p DayPlan, s State) []Violation {
	residents := make(map[string]Resident)
	for _, r := range uniqueResidents(s.Residents) {
		residents[r.ID] = r
	}
	tasks := make(map[string]Task)
	for _, t := range uniqueTasks(s.Tasks) {
		tasks[t.ID] = t
	}

	var out []Violation
	appearances := make(map[string]int)
	type pair struct{ task, resident string }
	counted := make(map[pair]bool)
	used := make(map[string]int)

	named := make(map[string]map[string]bool)
	for _, a := range p.Assignments {
		appearances[a.TaskID]++
		if named[a.TaskID] == nil {
			named[a.TaskID] = make(map[string]bool)
		}
		named[a.TaskID][a.ResidentID] = true
		t, taskKnown := tasks[a.TaskID]
		r, residentKnown := residents[a.ResidentID]
		if !taskKnown {
			out = append(out, Violation{Kind: UnknownTask, TaskID: a.TaskID, ResidentID: a.ResidentID,
				Detail: fmt.Sprintf("task %q is not an open task", a.TaskID)})
		}
		if !residentKnown {
			out = append(out, Violation{Kind: UnknownResident, TaskID: a.TaskID, ResidentID: a.ResidentID,
				Detail: fmt.Sprintf("resident %q is not in the home", a.ResidentID)})
		}
		if !taskKnown || !residentKnown {
			continue
		}
		if k := (pair{a.TaskID, a.ResidentID}); !counted[k] {
			counted[k] = true
			used[r.ID] += t.Effort
		}
		if !weekdayAllowed(t, s.Today) {
			out = append(out, Violation{Kind: WeekdayNotAllowed, TaskID: t.ID, ResidentID: r.ID,
				Detail: fmt.Sprintf("chore %q may not be done on weekday %d", t.ChoreID, s.Today.Weekday())})
		}
		demand, demandBroken, choreBroken := breaksRestriction(r, t)
		if demandBroken {
			out = append(out, Violation{Kind: BrokenRestriction, TaskID: t.ID, ResidentID: r.ID, Level: LevelDemand,
				Detail: fmt.Sprintf("resident %q cannot do demand %q", r.ID, demand)})
		}
		if choreBroken {
			out = append(out, Violation{Kind: BrokenRestriction, TaskID: t.ID, ResidentID: r.ID, Level: LevelChore,
				Detail: fmt.Sprintf("resident %q cannot do chore %q", r.ID, t.ChoreID)})
		}
	}

	for id, n := range appearances {
		t, known := tasks[id]
		distinct := len(named[id])
		if known && peopleNeeded(t) > 1 {
			if distinct != peopleNeeded(t) {
				out = append(out, Violation{Kind: WrongResidentCount, TaskID: id,
					Detail: fmt.Sprintf("task %q needs %d residents and is given to %d", id, peopleNeeded(t), distinct)})
			} else if n > distinct {
				out = append(out, Violation{Kind: DuplicateTask, TaskID: id,
					Detail: fmt.Sprintf("task %q is given %d times to %d residents", id, n, distinct)})
			}
			continue
		}
		if n > 1 {
			out = append(out, Violation{Kind: DuplicateTask, TaskID: id,
				Detail: fmt.Sprintf("task %q is given %d times", id, n)})
		}
	}
	for id, total := range used {
		if energy := energyOf(residents[id]); total > energy {
			out = append(out, Violation{Kind: OverEnergy, ResidentID: id,
				Detail: fmt.Sprintf("resident %q is given %d effort with %d energy", id, total, energy)})
		}
	}

	slices.SortFunc(out, func(a, b Violation) int {
		return cmp.Or(cmp.Compare(a.Kind, b.Kind), cmp.Compare(a.TaskID, b.TaskID),
			cmp.Compare(a.ResidentID, b.ResidentID), cmp.Compare(a.Level, b.Level))
	})
	return out
}
