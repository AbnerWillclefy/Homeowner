package allocation

import "testing"

type planCase struct {
	name       string
	state      State
	wantAssign []Assignment
	wantPool   []PoolEntry
}

func runPlanCases(t *testing.T, cases []planCase) {
	t.Helper()
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) { assertPlan(t, c.state, c.wantAssign, c.wantPool) })
	}
}

func TestPlanEnergyBudgets(t *testing.T) {
	runPlanCases(t, []planCase{
		{"exact fit", state(rs(resident("a", 3)), task("t", 3)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"one point over", state(rs(resident("a", 2)), task("t", 3)),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"drained resident gets nothing", state(rs(resident("a", 0)), task("t", 1)),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"task bigger than everyone", state(rs(resident("a", 2), resident("b", 3)), task("t", 4)),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"skipped big task does not block a smaller later one",
			state(rs(resident("a", 3)), task("big", 4, importance(Essential)), task("small", 3)),
			[]Assignment{give("small", "a", ReasonFitsEnergy)}, []PoolEntry{pool("big", ReasonNoEnergyLeft)}},
		{"efforts sum against one budget",
			state(rs(resident("a", 4)), task("t1", 2), task("t2", 2), task("t3", 1)),
			[]Assignment{give("t1", "a", ReasonFitsEnergy), give("t2", "a", ReasonFitsEnergy)},
			[]PoolEntry{pool("t3", ReasonNoEnergyLeft)}},
		{"negative energy counts as zero", state(rs(resident("a", -3)), task("t", 1)),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"no residents leaves everything in the pool", state(nil, task("t", 1)),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"invalid effort stays in the pool", state(rs(resident("a", 5)), task("t", 0)),
			nil, []PoolEntry{pool("t", ReasonInvalidEffort)}},
		{"two-person task is deferred", state(rs(resident("a", 5), resident("b", 5)), task("t", 1, people(2))),
			nil, []PoolEntry{pool("t", ReasonTwoPersonDeferred)}},
		{"empty state", state(nil), nil, nil},
		{"residents without tasks", state(rs(resident("a", 5))), nil, nil},
	})
}

func TestPlanUrgencyOrder(t *testing.T) {
	// One Resident with room for exactly one Effort-2 Task, so the winner is
	// the highest-ranked Task and the other stays in the pool.
	one := rs(resident("a", 2))
	runPlanCases(t, []planCase{
		{"deadline today beats importance",
			state(one, task("ess", 2, importance(Essential)), task("due", 2, importance(NiceToHave), deadlineIn(0))),
			[]Assignment{give("due", "a", ReasonDeadlineToday)}, []PoolEntry{pool("ess", ReasonNoEnergyLeft)}},
		{"overdue counts as deadline today",
			state(one, task("ess", 2, importance(Essential)), task("old", 2, deadlineIn(-3))),
			[]Assignment{give("old", "a", ReasonDeadlineToday)}, []PoolEntry{pool("ess", ReasonNoEnergyLeft)}},
		{"window closing tomorrow is not a deadline today",
			state(one, task("ess", 2, importance(Essential)), task("soon", 2, deadlineIn(1))),
			[]Assignment{give("ess", "a", ReasonImportance)}, []PoolEntry{pool("soon", ReasonNoEnergyLeft)}},
		{"importance beats lateness",
			state(one, task("late", 2, lateBy(5)), task("ess", 2, importance(Essential))),
			[]Assignment{give("ess", "a", ReasonImportance)}, []PoolEntry{pool("late", ReasonNoEnergyLeft)}},
		{"normal beats nice to have",
			state(one, task("nice", 2, importance(NiceToHave)), task("norm", 2)),
			[]Assignment{give("norm", "a", ReasonFitsEnergy)}, []PoolEntry{pool("nice", ReasonNoEnergyLeft)}},
		{"lateness decides among equals",
			state(one, task("t1", 2, lateBy(1)), task("t2", 2, lateBy(4))),
			[]Assignment{give("t2", "a", ReasonLateness)}, []PoolEntry{pool("t1", ReasonNoEnergyLeft)}},
		{"window not yet open is not late",
			state(one, task("future", 2, func(t *Task) { t.WindowStart = today + 3 }), task("now", 2, lateBy(1))),
			[]Assignment{give("now", "a", ReasonLateness)}, []PoolEntry{pool("future", ReasonNoEnergyLeft)}},
		{"task id breaks a full tie",
			state(one, task("b", 2), task("a", 2)),
			[]Assignment{give("a", "a", ReasonFitsEnergy)}, []PoolEntry{pool("b", ReasonNoEnergyLeft)}},
	})
}

func TestPlanRollover(t *testing.T) {
	runPlanCases(t, []planCase{
		{"more work than energy leaves the lowest ranked in the pool",
			state(rs(resident("a", 5)),
				task("nice", 2, importance(NiceToHave)), task("norm", 2), task("ess", 2, importance(Essential))),
			[]Assignment{give("ess", "a", ReasonImportance), give("norm", "a", ReasonFitsEnergy)},
			[]PoolEntry{pool("nice", ReasonNoEnergyLeft)}},
		{"two residents share a heavy day and the rest rolls over",
			state(rs(resident("a", 3), resident("b", 2)),
				task("t1", 3, importance(Essential)), task("t2", 2), task("t3", 2, lateBy(2)), task("t4", 1, importance(NiceToHave))),
			[]Assignment{give("t1", "a", ReasonImportance), give("t3", "b", ReasonLateness)},
			[]PoolEntry{pool("t2", ReasonNoEnergyLeft), pool("t4", ReasonNoEnergyLeft)}},
	})
}

func TestPlanRestrictions(t *testing.T) {
	lift := Demand("heavy_lifting")
	bend := Demand("bending")
	runPlanCases(t, []planCase{
		{"demand restriction reroutes to the other resident",
			state(rs(resident("a", 5).cannotDo(lift), resident("b", 3)), task("t", 2, demands(lift))),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"one restricted demand among several is enough",
			state(rs(resident("a", 5).cannotDo(bend), resident("b", 3)), task("t", 2, demands(lift, bend))),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"unrelated demand restriction does not block",
			state(rs(resident("a", 5).cannotDo(bend)), task("t", 2, demands(lift))),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"day-only demand restriction behaves like a general one",
			// The caller merges a Check-in's day-only Restrictions into DemandRestrictions.
			state(rs(resident("a", 5).cannotDo(bend, lift), resident("b", 5)), task("t", 1, demands(lift))),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"chore restriction reroutes to the other resident",
			state(rs(resident("a", 5).cannotDoChore("chore-t"), resident("b", 3)), task("t", 2)),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"chore restriction is per chore",
			state(rs(resident("a", 5).cannotDoChore("other")), task("t", 2)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"both residents restricted leaves it in the pool despite spare energy",
			state(rs(resident("a", 5).cannotDo(lift), resident("b", 5).cannotDoChore("chore-t")), task("t", 1, demands(lift))),
			nil, []PoolEntry{pool("t", ReasonRestrictedForAll)}},
		{"the only resident with energy is restricted",
			state(rs(resident("a", 0), resident("b", 5).cannotDo(lift)), task("t", 1, demands(lift))),
			nil, []PoolEntry{pool("t", ReasonNoEnergyLeft)}},
		{"restricted task does not stop others",
			state(rs(resident("a", 5).cannotDo(lift)), task("t1", 1, importance(Essential), demands(lift)), task("t2", 1)),
			[]Assignment{give("t2", "a", ReasonFitsEnergy)}, []PoolEntry{pool("t1", ReasonRestrictedForAll)}},
	})
}

func TestPlanSpreadsLoad(t *testing.T) {
	runPlanCases(t, []planCase{
		{"equal residents share the work, lowest id first",
			state(rs(resident("b", 4), resident("a", 4)), task("t1", 2), task("t2", 2)),
			[]Assignment{give("t1", "a", ReasonFitsEnergy), give("t2", "b", ReasonFitsEnergy)}, nil},
		{"the resident with most energy left goes first",
			state(rs(resident("a", 2), resident("b", 4)), task("t1", 2), task("t2", 2)),
			[]Assignment{give("t1", "b", ReasonFitsEnergy), give("t2", "a", ReasonFitsEnergy)}, nil},
	})
}

// Duplicate IDs keep the first occurrence, so this cannot go through the
// reordering in assertPlan.
func TestPlanDuplicateIDsKeepFirst(t *testing.T) {
	s := state(rs(resident("a", 5), resident("a", 1)), task("t", 2), task("t", 1))
	got, err := Plan(s)
	if err != nil {
		t.Fatal(err)
	}
	want := []Assignment{give("t", "a", ReasonFitsEnergy)}
	if len(got.DayPlan.Assignments) != 1 || got.DayPlan.Assignments[0] != want[0] || len(got.Pool) != 0 {
		t.Errorf("got %+v, want only %+v", got, want)
	}
	if v := Check(got.DayPlan, s); len(v) != 0 {
		t.Errorf("violations: %+v", v)
	}
}

func TestPlanAllowedWeekdays(t *testing.T) {
	wd := today.Weekday()
	other := (wd + 1) % 7
	runPlanCases(t, []planCase{
		{"allowed today is planned", state(rs(resident("a", 3)), task("t", 1, onlyOn(other, wd))),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"no weekday limit is allowed every day", state(rs(resident("a", 3)), task("t", 1)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"forbidden today stays in the pool", state(rs(resident("a", 3)), task("t", 1, onlyOn(other))),
			nil, []PoolEntry{pool("t", ReasonWeekdayNotAllowed)}},
		{"overdue task still waits for an allowed day",
			state(rs(resident("a", 3)), task("t", 1, onlyOn(other), lateBy(5), deadlineIn(-2))),
			nil, []PoolEntry{pool("t", ReasonWeekdayNotAllowed)}},
		{"weekday beats energy in the pool reason", state(rs(resident("a", 0)), task("t", 1, onlyOn(other))),
			nil, []PoolEntry{pool("t", ReasonWeekdayNotAllowed)}},
		{"forbidden task does not use energy", state(rs(resident("a", 1)), task("x", 1, onlyOn(other)), task("y", 1)),
			[]Assignment{give("y", "a", ReasonFitsEnergy)}, []PoolEntry{pool("x", ReasonWeekdayNotAllowed)}},
	})
}

func TestBaselineImplementsAllocator(t *testing.T) {
	var a Allocator = Baseline{}
	if _, err := a.Plan(state(nil)); err != nil {
		t.Fatal(err)
	}
}
