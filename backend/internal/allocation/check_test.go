package allocation

import (
	"cmp"
	"slices"
	"testing"
)

// key is a Violation without its prose Detail, so tests compare the data.
type key struct {
	Kind       ViolationKind
	TaskID     string
	ResidentID string
	Level      RestrictionLevel
}

func keys(vs []Violation) []key {
	out := make([]key, 0, len(vs))
	for _, v := range vs {
		if v.Detail == "" {
			panic("violation without detail: " + string(v.Kind))
		}
		out = append(out, key{v.Kind, v.TaskID, v.ResidentID, v.Level})
	}
	sortKeys(out)
	return out
}

func sortKeys(ks []key) {
	slices.SortFunc(ks, func(a, b key) int {
		return cmp.Or(cmp.Compare(a.Kind, b.Kind), cmp.Compare(a.TaskID, b.TaskID),
			cmp.Compare(a.ResidentID, b.ResidentID), cmp.Compare(a.Level, b.Level))
	})
}

func plan(a ...Assignment) DayPlan { return DayPlan{Assignments: a} }

func TestCheck(t *testing.T) {
	lift := Demand("heavy_lifting")
	bend := Demand("bending")

	cases := []struct {
		name  string
		state State
		plan  DayPlan
		want  []key
	}{
		{"valid plan",
			state(rs(resident("a", 3), resident("b", 2)), task("t1", 3), task("t2", 2)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t2", "b", ReasonFitsEnergy)), nil},
		{"empty plan", state(rs(resident("a", 3)), task("t1", 3)), plan(), nil},
		{"empty everything", state(nil), plan(), nil},
		{"exactly at energy is fine",
			state(rs(resident("a", 4)), task("t1", 2), task("t2", 2)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t2", "a", ReasonFitsEnergy)), nil},

		{"single task over energy",
			state(rs(resident("a", 2)), task("t1", 3)),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{OverEnergy, "", "a", ""}}},
		{"cumulative over energy is one violation per resident, not per task",
			state(rs(resident("a", 4), resident("b", 5)), task("t1", 2), task("t2", 2), task("t3", 2), task("t4", 1)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t2", "a", ReasonFitsEnergy), give("t3", "a", ReasonFitsEnergy),
				give("t4", "b", ReasonFitsEnergy)),
			[]key{{OverEnergy, "", "a", ""}}},
		{"drained resident given anything is over energy",
			state(rs(resident("a", 0)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{OverEnergy, "", "a", ""}}},
		{"negative energy counts as zero",
			state(rs(resident("a", -2)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{OverEnergy, "", "a", ""}}},

		{"broken demand restriction",
			state(rs(resident("a", 5).cannotDo(lift)), task("t1", 1, demands(bend, lift))),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{BrokenRestriction, "t1", "a", LevelDemand}}},
		{"broken chore restriction",
			state(rs(resident("a", 5).cannotDoChore("chore-t1")), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{BrokenRestriction, "t1", "a", LevelChore}}},
		{"both levels broken by one assignment are both reported",
			state(rs(resident("a", 5).cannotDo(lift).cannotDoChore("chore-t1")), task("t1", 1, demands(lift))),
			plan(give("t1", "a", ReasonFitsEnergy)),
			[]key{{BrokenRestriction, "t1", "a", LevelChore}, {BrokenRestriction, "t1", "a", LevelDemand}}},
		{"restriction on another resident does not matter",
			state(rs(resident("a", 5).cannotDo(lift), resident("b", 5)), task("t1", 1, demands(lift))),
			plan(give("t1", "b", ReasonFitsEnergy)), nil},

		{"task not in state",
			state(rs(resident("a", 5)), task("t1", 1)),
			plan(give("ghost", "a", ReasonFitsEnergy)),
			[]key{{UnknownTask, "ghost", "a", ""}}},
		{"unknown task does not count against energy",
			state(rs(resident("a", 1)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy), give("ghost", "a", ReasonFitsEnergy)),
			[]key{{UnknownTask, "ghost", "a", ""}}},
		{"task given twice to the same resident",
			state(rs(resident("a", 5)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t1", "a", ReasonFitsEnergy)),
			[]key{{DuplicateTask, "t1", "", ""}}},
		{"task given twice to different residents",
			state(rs(resident("a", 5), resident("b", 5)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t1", "b", ReasonFitsEnergy)),
			[]key{{DuplicateTask, "t1", "", ""}}},
		{"task given three times is one violation",
			state(rs(resident("a", 5), resident("b", 5)), task("t1", 1)),
			plan(give("t1", "a", ReasonFitsEnergy), give("t1", "b", ReasonFitsEnergy), give("t1", "a", ReasonFitsEnergy)),
			[]key{{DuplicateTask, "t1", "", ""}}},
		{"unknown resident",
			state(rs(resident("a", 5)), task("t1", 1)),
			plan(give("t1", "nobody", ReasonFitsEnergy)),
			[]key{{UnknownResident, "t1", "nobody", ""}}},
		{"unknown task and unknown resident",
			state(nil),
			plan(give("ghost", "nobody", ReasonFitsEnergy)),
			[]key{{UnknownResident, "ghost", "nobody", ""}, {UnknownTask, "ghost", "nobody", ""}}},

		{"several violations are all reported, not just the first",
			state(rs(resident("a", 2).cannotDo(lift), resident("b", 5).cannotDoChore("chore-t3")),
				task("t1", 2, demands(lift)), task("t2", 2), task("t3", 1), task("t4", 1)),
			plan(
				give("t1", "a", ReasonFitsEnergy),    // broken demand restriction; a at 2 of 2
				give("t2", "a", ReasonFitsEnergy),    // pushes a over energy
				give("t3", "b", ReasonFitsEnergy),    // broken chore restriction
				give("t4", "b", ReasonFitsEnergy),    // given twice
				give("t4", "zed", ReasonFitsEnergy),  // ...and to an unknown resident
				give("ghost", "b", ReasonFitsEnergy), // not in state
			),
			[]key{
				{OverEnergy, "", "a", ""},
				{BrokenRestriction, "t1", "a", LevelDemand},
				{BrokenRestriction, "t3", "b", LevelChore},
				{DuplicateTask, "t4", "", ""},
				{UnknownResident, "t4", "zed", ""},
				{UnknownTask, "ghost", "b", ""},
			}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := keys(Check(c.plan, c.state))
			want := slices.Clone(c.want)
			sortKeys(want)
			if !slices.Equal(got, want) {
				t.Errorf("violations:\n got  %+v\n want %+v", got, want)
			}
			// Check must not depend on the order of the plan.
			rev := DayPlan{Assignments: slices.Clone(c.plan.Assignments)}
			slices.Reverse(rev.Assignments)
			if again := keys(Check(rev, c.state)); !slices.Equal(again, got) {
				t.Errorf("reversed plan changed violations:\n got  %+v\n want %+v", again, got)
			}
		})
	}
}

func TestCheckOutputOrderIsStable(t *testing.T) {
	s := state(rs(resident("a", 0), resident("b", 0)), task("t1", 1), task("t2", 1))
	p := plan(give("t2", "b", ReasonFitsEnergy), give("t1", "a", ReasonFitsEnergy), give("t1", "b", ReasonFitsEnergy))
	first := Check(p, s)
	for range 20 {
		if !slices.Equal(first, Check(p, s)) {
			t.Fatal("Check output order changed between runs")
		}
	}
}
