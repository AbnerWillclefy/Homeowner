package dayplan_test

import (
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// A Committed Task is a promise: no re-plan takes it away, and what it costs
// comes off the Energy of the re-plan.

func TestACommittedTaskSurvivesALowCheckIn(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t) // Energy 4 for two Effort-2 Tasks
	mine := apitest.MineOf(t, a)
	kept, other := mine[0]["choreName"].(string), mine[1]["choreName"].(string)
	apitest.MustAct(t, a, "accept", mine[0]["id"].(string))

	apitest.CheckIn(t, a, "low") // 4 -> 2, all of it promised
	r := apitest.DayPlan(t, a)
	if got := names(apitest.TaskList(t, r.Body["mine"])); !slices.Equal(got, []string{kept}) {
		t.Fatalf("mine = %v, want only the committed %s: %s", got, kept, r.Raw)
	}
	if committedOf(apitest.TaskList(t, r.Body["mine"]), kept) != true {
		t.Fatalf("not committed any more: %s", r.Raw)
	}
	if reasonOf(apitest.TaskList(t, r.Body["pool"]), other) != "no_energy_left" {
		t.Fatalf("pool = %s", r.Raw)
	}
}

func TestACommittedTaskSurvivesADrainedCheckIn(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	kept := mine[0]["choreName"].(string)
	apitest.MustAct(t, a, "accept", mine[0]["id"].(string))

	apitest.CheckIn(t, a, "drained")
	r := apitest.DayPlan(t, a)
	if got := names(apitest.TaskList(t, r.Body["mine"])); !slices.Equal(got, []string{kept}) || r.Body["energy"] != float64(0) {
		t.Fatalf("after Drained: %s", r.Raw)
	}
}

func TestRightAwayKeepsCommittedTasksAndPlansOnlyTheEnergyLeft(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	kept := mine[0]["choreName"].(string)
	apitest.MustAct(t, a, "accept", mine[0]["id"].(string))

	r := planMe(t, a)
	got := apitest.TaskList(t, r.Body["mine"])
	if len(got) != 2 || committedOf(got, kept) != true || effortSum(got) > 4 {
		t.Fatalf("mine = %s, want the committed Task plus what fits in the rest of the 4", r.Raw)
	}
}

func TestANewProposedPlanPlusCommittedTasksFitTheEnergy(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	apitest.MustAct(t, a, "accept", mine[0]["id"].(string))
	for _, level := range []string{"low", "normal", "energized", "normal"} {
		apitest.CheckIn(t, a, level)
		r := apitest.DayPlan(t, a)
		energy := r.Body["energy"].(float64)
		if sum := effortSum(apitest.TaskList(t, r.Body["mine"])); sum > energy && sum > 2 {
			t.Fatalf("after %s: %v Effort for %v Energy: %s", level, sum, energy, r.Raw)
		}
		if committedOf(apitest.TaskList(t, r.Body["mine"]), mine[0]["choreName"].(string)) != true {
			t.Fatalf("after %s the Commitment was lost: %s", level, r.Raw)
		}
	}
}

func TestYesterdaysCommitmentIsNotCommittedToday(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 2, "tuesday": 2})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	id := apitest.MineOf(t, me)[0]["id"].(string)
	apitest.MustAct(t, me, "accept", id)

	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 1)) // undone: the Task is back in the pool
	if got := apitest.DayPlan(t, me).Body["pool"]; len(apitest.TaskList(t, got)) != 1 {
		t.Fatalf("yesterday's Task is not in the pool: %s", apitest.DayPlan(t, me).Raw)
	}
	app.RunAllocation(t)
	mine := apitest.MineOf(t, me)
	if len(mine) != 1 || mine[0]["committed"] != false {
		t.Fatalf("today: %s", apitest.DayPlan(t, me).Raw)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, id); got != 1 {
		t.Fatalf("yesterday's Commitment rows = %d, want it kept as history", got)
	}
}
