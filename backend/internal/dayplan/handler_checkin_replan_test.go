package dayplan_test

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func runCount(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM allocation_runs`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func effortSum(tasks []map[string]any) (sum float64) {
	for _, tk := range tasks {
		sum += tk["currentEffort"].(float64)
	}
	return sum
}

func TestACheckInAfterThePlanPlansThatResidentAgain(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})
	apitest.SetBaseline(t, b, map[string]any{"monday": 5})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t) // each Resident gets two Efforts-2 Tasks of 5 points
	bBefore := names(apitest.TaskList(t, apitest.DayPlan(t, b).Body["mine"]))
	if len(apitest.TaskList(t, apitest.DayPlan(t, a).Body["mine"])) != 2 || len(bBefore) != 2 {
		t.Fatalf("setup: %s", apitest.DayPlan(t, a).Raw)
	}

	// Low: 5 -> 2, so A keeps one Task and the other goes back to the pool.
	app.Clock.Set(apitest.MondayAt(9))
	apitest.CheckIn(t, a, "low")
	r := apitest.DayPlan(t, a)
	mine := apitest.TaskList(t, r.Body["mine"])
	if r.Body["energy"] != float64(2) || effortSum(mine) > 2 || len(mine) != 1 {
		t.Fatalf("after Low: %s", r.Raw)
	}
	if got := len(apitest.TaskList(t, r.Body["pool"])); got != 1 {
		t.Fatalf("pool = %d Tasks, want the released one: %s", got, r.Raw)
	}
	if reasonOf(apitest.TaskList(t, r.Body["pool"]), apitest.TaskList(t, r.Body["pool"])[0]["choreName"].(string)) != "no_energy_left" {
		t.Fatalf("released Task reason: %s", r.Raw)
	}
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, b).Body["mine"])); !slices.Equal(got, bBefore) {
		t.Fatalf("B's Tasks changed from %v to %v", bBefore, got)
	}
	if got := runCount(t, app); got != 1 {
		t.Fatalf("%d runs, want the same one", got)
	}

	// Energized: 5 -> 6, so A is planned again and can take more.
	apitest.CheckIn(t, a, "energized")
	r = apitest.DayPlan(t, a)
	if r.Body["energy"] != float64(6) || len(apitest.TaskList(t, r.Body["mine"])) != 2 {
		t.Fatalf("after Energized: %s", r.Raw)
	}
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, b).Body["mine"])); !slices.Equal(got, bBefore) {
		t.Fatalf("B's Tasks changed from %v to %v", bBefore, got)
	}
}

func TestDrainedYieldsAnEmptyDayPlanBeforeAndAfterThePlan(t *testing.T) {
	t.Parallel()
	for _, after := range []bool{false, true} {
		name := "before"
		if after {
			name = "after"
		}
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app := apitest.Start(t)
			me := apitest.HomeWithResident(t, app, "a@example.com")
			apitest.SetBaseline(t, me, map[string]any{"monday": 5})
			app.Clock.Set(apitest.MondayAt(6))
			apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "essential", []string{}))
			apitest.CreateChore(t, me, apitest.Chore("Mop", 7, 2, "normal", []string{}))
			if !after {
				apitest.CheckIn(t, me, "drained")
			}
			app.Clock.Set(apitest.MondayAt(7))
			app.RunAllocation(t)
			if after {
				if got := len(apitest.TaskList(t, apitest.DayPlan(t, me).Body["mine"])); got != 2 {
					t.Fatalf("setup: mine = %d", got)
				}
				apitest.CheckIn(t, me, "drained")
			}
			r := apitest.DayPlan(t, me)
			if r.Body["planned"] != true || r.Body["energy"] != float64(0) || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
				t.Fatalf("body = %s", r.Raw)
			}
			pooled := apitest.TaskList(t, r.Body["pool"])
			if len(pooled) != 2 || reasonOf(pooled, "Dishes") != "no_energy_left" {
				t.Fatalf("pool = %s", r.Raw)
			}
		})
	}
}

func TestADayRestrictionAfterThePlanReleasesTheTask(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 10, "tuesday": 10})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Move sofa", 1, 3, "normal", []string{"heavy_lifting"}))
	apitest.CreateChore(t, me, apitest.Chore("Cook", 1, 3, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, me).Body["mine"])); len(got) != 2 {
		t.Fatalf("setup: %v", got)
	}

	apitest.CheckIn(t, me, "normal", "heavy_lifting")
	r := apitest.DayPlan(t, me)
	if got := names(apitest.TaskList(t, r.Body["mine"])); len(got) != 1 || got[0] != "Cook" {
		t.Fatalf("mine = %v, want only Cook: %s", got, r.Raw)
	}
	if reasonOf(apitest.TaskList(t, r.Body["pool"]), "Move sofa") != "restricted_for_all" {
		t.Fatalf("pool = %s", r.Raw)
	}
	if p := string(me.Get("/me/profile").Raw); !strings.Contains(p, `"restrictions":[]`) {
		t.Fatalf("profile gained a Restriction: %s", p)
	}

	// Changing the Check-in back lets the Task return to the Resident.
	apitest.CheckIn(t, me, "normal")
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, me).Body["mine"])); len(got) != 2 {
		t.Fatalf("after clearing the Restriction: %v", got)
	}
}

func TestAResidentWhoJoinedAfterThePlanIsPlannedByTheirFirstCheckIn(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 2})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.Chore("One", 7, 2, "normal", []string{}))
	apitest.CreateChore(t, a, apitest.Chore("Two", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t) // A takes one; one stays in the pool

	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	r := apitest.DayPlan(t, b)
	if r.Body["energy"] != float64(0) || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("a joiner is unplanned until they check in: %s", r.Raw)
	}
	apitest.CheckIn(t, b, "normal")
	r = apitest.DayPlan(t, b)
	if r.Body["energy"] != float64(4) || len(apitest.TaskList(t, r.Body["mine"])) != 1 {
		t.Fatalf("after the first Check-in: %s", r.Raw)
	}
	if got := len(apitest.TaskList(t, apitest.DayPlan(t, a).Body["mine"])); got != 1 {
		t.Fatalf("A's Tasks changed: %d", got)
	}
}

func TestATaskAddedAfterThePlanIsACandidateInTheReplan(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 10})
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t) // nothing to do yet
	apitest.CreateChore(t, me, apitest.Chore("Late", 7, 2, "normal", []string{}))
	apitest.Pool(t, me) // opens the Task

	apitest.CheckIn(t, me, "normal")
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, me).Body["mine"])); len(got) != 1 || got[0] != "Late" {
		t.Fatalf("mine = %v, want Late", got)
	}
}

func TestACheckInAfterARejectedRunIsStoredAndChangesNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com") // no Baseline: 0 Energy
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.UseAllocator(overEnergy{})
	app.Clock.Set(apitest.MondayAt(7))
	if sum := app.RunAllocation(t); sum.Rejected != 1 {
		t.Fatalf("setup: %+v", sum)
	}

	apitest.CheckIn(t, me, "energized")
	if got := me.Get("/home/check-in").Body["level"]; got != "energized" {
		t.Fatalf("level = %v, want it saved", got)
	}
	r := apitest.DayPlan(t, me)
	if r.Body["rejected"] != true || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("a rejected day changed: %s", r.Raw)
	}
	var assignments int
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM day_plan_assignments`).Scan(&assignments); err != nil || assignments != 0 {
		t.Fatalf("assignments = %d, %v", assignments, err)
	}
}

// overEnergy gives every Task to the first Resident, ignoring Energy, which the
// checker must refuse.
func TestAReplanThatBreaksARuleFailsAndLeavesTheCheckInAndPlanAsTheyWere(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Mop", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	apitest.CheckIn(t, me, "normal")
	planBefore := string(apitest.DayPlan(t, me).Raw)

	app.UseAllocator(overEnergy{})
	r := me.Put("/home/check-in", map[string]any{"level": "drained", "restrictions": []string{"bending"}})
	if r.Status != http.StatusInternalServerError {
		t.Fatalf("PUT = %d %s, want 500", r.Status, r.Raw)
	}
	got := me.Get("/home/check-in")
	if got.Body["level"] != "normal" || len(got.Body["restrictions"].([]any)) != 0 {
		t.Fatalf("the failed PUT changed the Check-in: %s", got.Raw)
	}
	if after := string(apitest.DayPlan(t, me).Raw); after != planBefore {
		t.Fatalf("the plan changed:\nbefore %s\nafter  %s", planBefore, after)
	}
}

func TestACheckInRacingTheJobLeavesOneRunAndAConsistentPlan(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 10})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three"} {
		apitest.CreateChore(t, me, apitest.Chore(n, 7, 3, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			app.Planner.RunDue(context.Background(), app.Clock.Now()) //nolint:errcheck
		}()
		go func() {
			defer wg.Done()
			if r := me.Put("/home/check-in", map[string]any{"level": "low"}); r.Status != http.StatusOK {
				t.Errorf("PUT = %d %s", r.Status, r.Raw)
			}
		}()
	}
	wg.Wait()

	if got := runCount(t, app); got != 1 {
		t.Fatalf("%d runs, want 1", got)
	}
	r := apitest.DayPlan(t, me)
	if r.Body["energy"] != float64(5) || effortSum(apitest.TaskList(t, r.Body["mine"])) > 5 {
		t.Fatalf("inconsistent plan: %s", r.Raw)
	}
}
