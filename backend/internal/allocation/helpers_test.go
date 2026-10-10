package allocation

import (
	"slices"
	"testing"
)

var today = NewDate(2026, 10, 10)

// task builds an open Task with Effort e, Normal Importance, one person and a
// window that opens today and closes in a week (no deadline, no lateness).
func task(id string, e int, opts ...func(*Task)) Task {
	t := Task{
		ID: id, ChoreID: "chore-" + id, Effort: e, Importance: Normal, People: 1,
		WindowStart: today, WindowEnd: today + 7,
	}
	for _, o := range opts {
		o(&t)
	}
	return t
}

func importance(i Importance) func(*Task) { return func(t *Task) { t.Importance = i } }
func demands(d ...Demand) func(*Task)     { return func(t *Task) { t.Demands = d } }
func people(n int) func(*Task)            { return func(t *Task) { t.People = n } }
func deadlineIn(days int) func(*Task)     { return func(t *Task) { t.WindowEnd = today + Date(days) } }
func lateBy(days int) func(*Task)         { return func(t *Task) { t.WindowStart = today - Date(days) } }

func resident(id string, energy int) Resident { return Resident{ID: id, Energy: energy} }

func (r Resident) cannotDo(d ...Demand) Resident {
	r.DemandRestrictions = d
	return r
}

func (r Resident) cannotDoChore(c ...string) Resident {
	r.ChoreRestrictions = c
	return r
}

func state(rs []Resident, ts ...Task) State {
	return State{Today: today, Residents: rs, Tasks: ts}
}

func rs(r ...Resident) []Resident { return r }

func give(task, resident string, why Reason) Assignment {
	return Assignment{TaskID: task, ResidentID: resident, Reason: why}
}

func pool(task string, why Reason) PoolEntry { return PoolEntry{TaskID: task, Reason: why} }

// assertPlan runs Plan, compares the assignments and pool, requires the same
// output for reordered input, and then requires Check to report no violations
// on the output. Every baseline test goes through it.
func assertPlan(t *testing.T, s State, wantAssign []Assignment, wantPool []PoolEntry) {
	t.Helper()
	got, err := Plan(s)
	if err != nil {
		t.Fatalf("Plan: %v", err)
	}
	if !slices.Equal(got.DayPlan.Assignments, wantAssign) {
		t.Errorf("assignments:\n got  %+v\n want %+v", got.DayPlan.Assignments, wantAssign)
	}
	if !slices.Equal(got.Pool, wantPool) {
		t.Errorf("pool:\n got  %+v\n want %+v", got.Pool, wantPool)
	}
	for name, variant := range map[string]State{"reversed": reversed(s), "rotated": rotated(s)} {
		again, err := Plan(variant)
		if err != nil {
			t.Fatalf("Plan(%s): %v", name, err)
		}
		if !slices.Equal(again.DayPlan.Assignments, got.DayPlan.Assignments) || !slices.Equal(again.Pool, got.Pool) {
			t.Errorf("%s input changed the result:\n got  %+v\n want %+v", name, again, got)
		}
	}
	if v := Check(got.DayPlan, s); len(v) != 0 {
		t.Errorf("Check reported violations on Plan output: %+v", v)
	}
}

func reversed(s State) State {
	s.Residents = slices.Clone(s.Residents)
	s.Tasks = slices.Clone(s.Tasks)
	slices.Reverse(s.Residents)
	slices.Reverse(s.Tasks)
	return s
}

func rotated(s State) State {
	rr := slices.Clone(s.Residents)
	tt := slices.Clone(s.Tasks)
	if len(rr) > 1 {
		rr = append(rr[1:], rr[0])
	}
	if len(tt) > 1 {
		tt = append(tt[1:], tt[0])
	}
	s.Residents, s.Tasks = rr, tt
	return s
}
