package allocation

import "testing"

// Eligible says whether a Resident may be given a Task today by the hard
// rules that do not depend on Energy: weekday and Restrictions.
func TestEligible(t *testing.T) {
	t.Parallel()
	weekday := today.Weekday()
	other := (weekday + 1) % 7
	for name, tc := range map[string]struct {
		r    Resident
		t    Task
		want bool
	}{
		"no restriction":            {resident("r", 3), task("a", 1), true},
		"demand restriction":        {resident("r", 3).cannotDo("heights"), task("a", 1, demands("heights")), false},
		"unrelated demand":          {resident("r", 3).cannotDo("heights"), task("a", 1, demands("lifting")), true},
		"chore restriction":         {resident("r", 3).cannotDoChore(choreOf("a")), task("a", 1), false},
		"other chore restriction":   {resident("r", 3).cannotDoChore(choreOf("b")), task("a", 1), true},
		"weekday not allowed":       {resident("r", 3), task("a", 1, onlyOn(other)), false},
		"weekday allowed":           {resident("r", 3), task("a", 1, onlyOn(weekday)), true},
		"zero energy is still fine": {resident("r", 0), task("a", 1), true},
		"not the responsible one":   {resident("r", 3), task("a", 1, responsible("x")), false},
		"the responsible one":       {resident("r", 3), task("a", 1, responsible("r")), true},
		"two-person, not the one":   {resident("r", 3), task("a", 1, people(2), responsible("x")), true},
		"restricted and wrong day":  {resident("r", 3).cannotDoChore(choreOf("a")), task("a", 1, onlyOn(other)), false},
	} {
		if got := Eligible(tc.r, tc.t, today); got != tc.want {
			t.Errorf("%s: Eligible = %v, want %v", name, got, tc.want)
		}
	}
}

// Eligible and Check read the same rules: a Resident is eligible exactly when
// Check finds neither a restriction nor a weekday violation in a plan that
// gives them the Task (Energy aside).
func TestEligibleAgreesWithCheck(t *testing.T) {
	t.Parallel()
	weekday := today.Weekday()
	other := (weekday + 1) % 7
	residents := []Resident{
		resident("free", 5),
		resident("nodemand", 5).cannotDo("heights"),
		resident("nochore", 5).cannotDoChore(choreOf("a")),
		resident("both", 5).cannotDo("heights").cannotDoChore(choreOf("a")),
	}
	tasks := []Task{
		task("a", 1),
		task("a", 1, demands("heights")),
		task("a", 1, onlyOn(other)),
		task("a", 1, onlyOn(weekday), demands("heights", "lifting")),
		task("a", 1, onlyOn(other), demands("heights")),
		task("a", 1, responsible("free")),
		task("a", 1, responsible("nodemand")),
		task("a", 1, responsible("nodemand"), demands("heights")),
	}
	// Two-person Tasks stay out of this loop: a one-row plan for one reports
	// NotResponsible for the pair, while Eligible judges one Resident.
	checked, notResponsible := 0, 0
	for _, tk := range tasks {
		for _, r := range residents {
			s := State{Today: today, Residents: []Resident{r}, Tasks: []Task{tk}}
			clean := true
			for _, v := range Check(DayPlan{Assignments: []Assignment{{TaskID: tk.ID, ResidentID: r.ID}}}, s) {
				if v.Kind == BrokenRestriction || v.Kind == WeekdayNotAllowed || v.Kind == NotResponsible {
					clean = false
				}
				if v.Kind == NotResponsible {
					notResponsible++
				}
			}
			if got := Eligible(r, tk, today); got != clean {
				t.Errorf("resident %s, task %+v: Eligible = %v, Check clean = %v", r.ID, tk, got, clean)
			}
			checked++
		}
	}
	if checked != len(tasks)*len(residents) || notResponsible == 0 {
		t.Fatalf("checked %d pairs, %d not responsible: the loop did not cover responsibility", checked, notResponsible)
	}
}
