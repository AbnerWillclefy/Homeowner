package dayplan_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// planned is one Resident with Energy `energy` on Monday and the given Chores,
// planned at 07:00.
func planned(t *testing.T, energy int, chores ...map[string]any) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": energy})
	app.Clock.Set(apitest.MondayAt(6))
	for _, c := range chores {
		apitest.CreateChore(t, me, c)
	}
	return app, me
}

func allocate(app *apitest.App, t *testing.T) {
	t.Helper()
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
}

func TestTakeCommitsAPoolTaskToTheCaller(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	pooled := apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"])[0]
	name := pooled["choreName"].(string)

	r := apitest.MustAct(t, a, "take", pooled["id"].(string))
	mine := apitest.TaskList(t, r.Body["mine"])
	if len(mine) != 3 || committedOf(mine, name) != true || reasonOf(mine, name) != "taken" {
		t.Fatalf("mine = %s", r.Raw)
	}
	if len(apitest.TaskList(t, r.Body["pool"])) != 0 {
		t.Fatalf("still in the pool: %s", r.Raw)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, pooled["id"]); got != 1 {
		t.Fatalf("%d commitments, want 1", got)
	}
	// A re-plan keeps it, as any Committed Task.
	apitest.CheckIn(t, a, "normal")
	if got := committedOf(apitest.MineOf(t, a), name); got != true {
		t.Fatalf("after a Check-in: %s", apitest.DayPlan(t, a).Raw)
	}
}

func TestTakeWorksOnARefusedTask(t *testing.T) {
	t.Parallel()
	_, a, b := apitest.TwoResidents(t)
	refused := apitest.MineOf(t, a)[0]
	apitest.MustAct(t, a, "refuse", refused["id"].(string))
	r := apitest.MustAct(t, b, "take", refused["id"].(string))
	if committedOf(apitest.TaskList(t, r.Body["mine"]), refused["choreName"].(string)) != true {
		t.Fatalf("B did not get it: %s", r.Raw)
	}
	if reasonOf(apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"]), refused["choreName"].(string)) != "missing" {
		t.Fatalf("still pooled for A: %s", apitest.DayPlan(t, a).Raw)
	}
}

func TestTakeNeedsATaskInThePool(t *testing.T) {
	t.Parallel()
	_, a, b := apitest.TwoResidents(t)
	wantConflict(t, apitest.Act(a, "take", apitest.MineOf(t, a)[0]["id"].(string)), "not_in_pool")
	wantConflict(t, apitest.Act(a, "take", apitest.MineOf(t, b)[0]["id"].(string)), "not_in_pool")
}

func TestTakeNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	_, me := planned(t, 5, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "no_plan_today")
}

func TestTakeMayExceedEnergy(t *testing.T) {
	t.Parallel()
	app, me := planned(t, 2, apitest.Chore("Big", 7, 4, "normal", []string{}))
	allocate(app, t)
	if reasonOf(apitest.TaskList(t, apitest.DayPlan(t, me).Body["pool"]), "Big") != "no_energy_left" {
		t.Fatalf("setup: %s", apitest.DayPlan(t, me).Raw)
	}
	r := apitest.MustAct(t, me, "take", apitest.Pool(t, me)[0]["id"].(string))
	if mine := apitest.TaskList(t, r.Body["mine"]); len(mine) != 1 || r.Body["energy"] != float64(2) {
		t.Fatalf("mine = %s", r.Raw)
	}
}

func TestTakeNeverBreaksARestriction(t *testing.T) {
	t.Parallel()
	t.Run("demand", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10, apitest.Chore("Move sofa", 7, 2, "normal", []string{"heavy_lifting"}))
		apitest.ExpectStatus(t, me.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
		allocate(app, t)
		wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "restricted")
		if len(apitest.MineOf(t, me)) != 0 {
			t.Fatalf("taken anyway: %s", apitest.DayPlan(t, me).Raw)
		}
	})
	t.Run("chore", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10)
		id := apitest.CreateChore(t, me, apitest.Chore("Cook", 7, 2, "normal", []string{}))
		apitest.ExpectStatus(t, me.Put("/home/chores/"+id+"/restriction", nil), http.StatusNoContent)
		allocate(app, t)
		wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "restricted")
	})
	t.Run("day restriction from the check-in", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10, apitest.Chore("Move sofa", 7, 2, "normal", []string{"heavy_lifting"}))
		apitest.CheckIn(t, me, "normal", "heavy_lifting")
		allocate(app, t)
		wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "restricted")
	})
	t.Run("weekday not allowed", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := apitest.HomeWithResident(t, app, "a@example.com")
		apitest.SetBaseline(t, me, map[string]any{"tuesday": 0, "wednesday": 5})
		apitest.AtDay(app, 3)
		apitest.CreateChore(t, me, apitest.Chore("Garden", 1, 2, "normal", []string{}, 2)) // Tuesdays only
		app.RunAllocation(t)
		apitest.AtDay(app, 4) // Wednesday: the Task is overdue, but the day is forbidden
		app.RunAllocation(t)
		if reasonOf(apitest.TaskList(t, apitest.DayPlan(t, me).Body["pool"]), "Garden") != "weekday_not_allowed" {
			t.Fatalf("setup: %s", apitest.DayPlan(t, me).Raw)
		}
		wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "restricted")
	})
}

func TestATwoPersonTaskCannotBeTakenYet(t *testing.T) {
	t.Parallel()
	two := apitest.Chore("Move bed", 7, 2, "normal", []string{})
	two["people"] = 2
	app, me := planned(t, 10, two)
	allocate(app, t)
	wantConflict(t, apitest.Act(me, "take", apitest.Pool(t, me)[0]["id"].(string)), "two_person_task")
}
