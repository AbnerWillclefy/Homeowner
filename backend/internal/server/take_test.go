package server_test

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
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": energy})
	app.Clock.Set(mondayAt(6))
	for _, c := range chores {
		createChore(t, me, c)
	}
	return app, me
}

func allocate(app *apitest.App, t *testing.T) {
	t.Helper()
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
}

func TestTakeCommitsAPoolTaskToTheCaller(t *testing.T) {
	t.Parallel()
	app, a, _ := twoResidents(t)
	pooled := taskList(t, dayPlan(t, a).Body["pool"])[0]
	name := pooled["choreName"].(string)

	r := mustAct(t, a, "take", pooled["id"].(string))
	mine := taskList(t, r.Body["mine"])
	if len(mine) != 3 || committedOf(mine, name) != true || reasonOf(mine, name) != "taken" {
		t.Fatalf("mine = %s", r.Raw)
	}
	if len(taskList(t, r.Body["pool"])) != 0 {
		t.Fatalf("still in the pool: %s", r.Raw)
	}
	if got := count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, pooled["id"]); got != 1 {
		t.Fatalf("%d commitments, want 1", got)
	}
	// A re-plan keeps it, as any Committed Task.
	checkIn(t, a, "normal")
	if got := committedOf(mineOf(t, a), name); got != true {
		t.Fatalf("after a Check-in: %s", dayPlan(t, a).Raw)
	}
}

func TestTakeWorksOnARefusedTask(t *testing.T) {
	t.Parallel()
	_, a, b := twoResidents(t)
	refused := mineOf(t, a)[0]
	mustAct(t, a, "refuse", refused["id"].(string))
	r := mustAct(t, b, "take", refused["id"].(string))
	if committedOf(taskList(t, r.Body["mine"]), refused["choreName"].(string)) != true {
		t.Fatalf("B did not get it: %s", r.Raw)
	}
	if reasonOf(taskList(t, dayPlan(t, a).Body["pool"]), refused["choreName"].(string)) != "missing" {
		t.Fatalf("still pooled for A: %s", dayPlan(t, a).Raw)
	}
}

func TestTakeNeedsATaskInThePool(t *testing.T) {
	t.Parallel()
	_, a, b := twoResidents(t)
	wantConflict(t, act(a, "take", mineOf(t, a)[0]["id"].(string)), "not_in_pool")
	wantConflict(t, act(a, "take", mineOf(t, b)[0]["id"].(string)), "not_in_pool")
}

func TestTakeNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	_, me := planned(t, 5, chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "no_plan_today")
}

func TestTakeMayExceedEnergy(t *testing.T) {
	t.Parallel()
	app, me := planned(t, 2, chore("Big", 7, 4, "normal", []string{}))
	allocate(app, t)
	if reasonOf(taskList(t, dayPlan(t, me).Body["pool"]), "Big") != "no_energy_left" {
		t.Fatalf("setup: %s", dayPlan(t, me).Raw)
	}
	r := mustAct(t, me, "take", pool(t, me)[0]["id"].(string))
	if mine := taskList(t, r.Body["mine"]); len(mine) != 1 || r.Body["energy"] != float64(2) {
		t.Fatalf("mine = %s", r.Raw)
	}
}

func TestTakeNeverBreaksARestriction(t *testing.T) {
	t.Parallel()
	t.Run("demand", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10, chore("Move sofa", 7, 2, "normal", []string{"heavy_lifting"}))
		expectStatus(t, me.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
		allocate(app, t)
		wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "restricted")
		if len(mineOf(t, me)) != 0 {
			t.Fatalf("taken anyway: %s", dayPlan(t, me).Raw)
		}
	})
	t.Run("chore", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10)
		id := createChore(t, me, chore("Cook", 7, 2, "normal", []string{}))
		expectStatus(t, me.Put("/home/chores/"+id+"/restriction", nil), http.StatusNoContent)
		allocate(app, t)
		wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "restricted")
	})
	t.Run("day restriction from the check-in", func(t *testing.T) {
		t.Parallel()
		app, me := planned(t, 10, chore("Move sofa", 7, 2, "normal", []string{"heavy_lifting"}))
		checkIn(t, me, "normal", "heavy_lifting")
		allocate(app, t)
		wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "restricted")
	})
	t.Run("weekday not allowed", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := homeWithResident(t, app, "a@example.com")
		setBaseline(t, me, map[string]any{"tuesday": 0, "wednesday": 5})
		atDay(app, 3)
		createChore(t, me, chore("Garden", 1, 2, "normal", []string{}, 2)) // Tuesdays only
		app.RunAllocation(t)
		atDay(app, 4) // Wednesday: the Task is overdue, but the day is forbidden
		app.RunAllocation(t)
		if reasonOf(taskList(t, dayPlan(t, me).Body["pool"]), "Garden") != "weekday_not_allowed" {
			t.Fatalf("setup: %s", dayPlan(t, me).Raw)
		}
		wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "restricted")
	})
}

func TestATwoPersonTaskCannotBeTakenYet(t *testing.T) {
	t.Parallel()
	two := chore("Move bed", 7, 2, "normal", []string{})
	two["people"] = 2
	app, me := planned(t, 10, two)
	allocate(app, t)
	wantConflict(t, act(me, "take", pool(t, me)[0]["id"].(string)), "two_person_task")
}
