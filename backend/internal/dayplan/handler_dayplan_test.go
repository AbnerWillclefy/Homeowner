package dayplan_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// The harness Home is in UTC with the Allocation time at 07:00, and atDay
// puts the fake clock at 09:00 UTC, so a Home is due on any atDay.
// 2 March 2026 is a Monday.

func dayPlan(t *testing.T, c *apitest.Client) apitest.Response {
	t.Helper()
	r := c.Get("/home/day-plan")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/day-plan = %d %s", r.Status, r.Raw)
	}
	return r
}

// taskList reads an array of Tasks (objects) out of a decoded body.
func taskList(t *testing.T, v any) []map[string]any {
	t.Helper()
	l, ok := v.([]any)
	if !ok {
		t.Fatalf("not an array: %v", v)
	}
	out := make([]map[string]any, len(l))
	for i, x := range l {
		out[i] = x.(map[string]any)
	}
	return out
}

func names(tasks []map[string]any) []string {
	out := []string{}
	for _, tk := range tasks {
		out = append(out, tk["choreName"].(string))
	}
	return out
}

func reasonOf(tasks []map[string]any, name string) any {
	for _, tk := range tasks {
		if tk["choreName"] == name {
			return tk["reason"]
		}
	}
	return "missing"
}

func TestTheDayPlanBeforeTheAllocationTimeIsTheOpenPoolAndPlansNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")             // UTC, 07:00
	app.Clock.Set(time.Date(2026, time.March, 2, 5, 0, 0, 0, time.UTC)) // before 07:00
	apitest.CreateChore(t, me, apitest.Recurring("Dust", 7, 2, false))

	// Reading the plan never refreshes the Tasks: nothing is open yet.
	r := dayPlan(t, me)
	if r.Body["planned"] != false || r.Body["date"] != "2026-03-02" || r.Body["allocationTime"] != "07:00" {
		t.Fatalf("body = %s", r.Raw)
	}
	if len(taskList(t, r.Body["pool"])) != 0 {
		t.Fatalf("a GET refreshed the pool: %s", r.Raw)
	}

	apitest.Pool(t, me) // the lazy refresh opens the Task
	r = dayPlan(t, me)
	if r.Body["planned"] != false || r.Body["rejected"] != false {
		t.Fatalf("body = %s", r.Raw)
	}
	if got := names(taskList(t, r.Body["pool"])); len(got) != 1 || got[0] != "Dust" {
		t.Fatalf("pool = %v, want the open pool", got)
	}
	if len(taskList(t, r.Body["mine"])) != 0 || len(taskList(t, r.Body["others"])) != 0 {
		t.Fatalf("assignments before the plan: %s", r.Raw)
	}
	app.RunAllocation(t) // 05:00 local: not due
	if r := dayPlan(t, me); r.Body["planned"] != false {
		t.Fatalf("planned before the Allocation time: %s", r.Raw)
	}
}

func TestTheDayPlanAfterAllocationHasMyTasksAndTheirReasons(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 3, "essential", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Mop", 7, 4, "normal", []string{}))
	app.RunAllocation(t) // refreshes the Tasks itself, then plans

	r := dayPlan(t, me)
	if r.Body["planned"] != true || r.Body["rejected"] != false || r.Body["allocator"] != "baseline" || r.Body["energy"] != float64(5) {
		t.Fatalf("body = %s", r.Raw)
	}
	mine, poolL := taskList(t, r.Body["mine"]), taskList(t, r.Body["pool"])
	if got := names(mine); len(got) != 1 || got[0] != "Dishes" {
		t.Fatalf("mine = %v, want only Dishes (3 of 5 points; Mop would be 7)", got)
	}
	if mine[0]["reason"] != "importance" || mine[0]["currentEffort"] != float64(3) || mine[0]["importance"] != "essential" {
		t.Fatalf("mine[0] = %v", mine[0])
	}
	if reasonOf(poolL, "Mop") != "no_energy_left" {
		t.Fatalf("pool = %v, want Mop left with no_energy_left", poolL)
	}
}

func TestEnergyComesFromTheBaselineOfTheWeekday(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5, "tuesday": 2})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Big", 7, 3, "normal", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Small", 7, 2, "normal", []string{}))

	// Monday: 5 points, both fit
	app.RunAllocation(t)
	r := dayPlan(t, me)
	if got := names(taskList(t, r.Body["mine"])); len(got) != 2 || r.Body["energy"] != float64(5) {
		t.Fatalf("Monday: mine = %v energy = %v, want both Tasks on 5", got, r.Body["energy"])
	}

	apitest.AtDay(app, 3) // Tuesday: 2 points. Only the open Tasks matter; yesterday's plan is not today's.
	app.RunAllocation(t)
	r = dayPlan(t, me)
	if got := names(taskList(t, r.Body["mine"])); len(got) != 1 || got[0] != "Small" || r.Body["energy"] != float64(2) {
		t.Fatalf("Tuesday: mine = %v energy = %v, want only Small on 2", got, r.Body["energy"])
	}
	if reasonOf(taskList(t, r.Body["pool"]), "Big") != "no_energy_left" {
		t.Fatalf("Tuesday pool = %s", r.Raw)
	}
}

func TestAnUnsetBaselineGivesNothingAndIsNotAnError(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"tuesday": 5}) // Monday is unset
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 1, "essential", []string{}))
	app.RunAllocation(t)

	r := dayPlan(t, me)
	if r.Body["planned"] != true || r.Body["energy"] != float64(0) || len(taskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("body = %s", r.Raw)
	}
	if reasonOf(taskList(t, r.Body["pool"]), "Dishes") != "no_energy_left" {
		t.Fatalf("pool = %s", r.Raw)
	}
}

func TestTheDayPlanHonoursRestrictionsAtBothLevels(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetBaseline(t, c, map[string]any{"monday": 10})
	}
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, a, apitest.Chore("Move sofa", 7, 3, "normal", []string{"heavy_lifting"}))
	plain := apitest.CreateChore(t, a, apitest.Chore("Cook", 7, 3, "normal", []string{}))

	// General level: A cannot do heavy lifting, so B gets the sofa.
	apitest.ExpectStatus(t, a.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
	// Specific level: B cannot do Cook in this Home, so A gets Cook.
	apitest.ExpectStatus(t, b.Put("/home/chores/"+plain+"/restriction", nil), http.StatusNoContent)
	app.RunAllocation(t)

	if got := reasonOf(taskList(t, dayPlan(t, a).Body["mine"]), "Cook"); got == "missing" {
		t.Errorf("A should have Cook")
	}
	if got := names(taskList(t, dayPlan(t, a).Body["mine"])); len(got) != 1 {
		t.Errorf("A's tasks = %v, want only Cook", got)
	}
	if got := names(taskList(t, dayPlan(t, b).Body["mine"])); len(got) != 1 || got[0] != "Move sofa" {
		t.Errorf("B's tasks = %v, want only Move sofa", got)
	}
	if others := taskList(t, dayPlan(t, a).Body["others"]); len(others) != 1 {
		t.Errorf("A sees %d other Residents with Tasks, want 1", len(others))
	}
}

func TestATaskNobodyMayDoStaysInThePool(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetBaseline(t, c, map[string]any{"monday": 10})
	}
	apitest.AtDay(app, 2)
	lift := apitest.CreateChore(t, a, apitest.Chore("Move sofa", 7, 3, "normal", []string{"heavy_lifting"}))
	apitest.ExpectStatus(t, a.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent) // general, A
	apitest.ExpectStatus(t, b.Put("/home/chores/"+lift+"/restriction", nil), http.StatusNoContent)
	app.RunAllocation(t)

	for _, c := range []*apitest.Client{a, b} {
		r := dayPlan(t, c)
		if len(taskList(t, r.Body["mine"])) != 0 || reasonOf(taskList(t, r.Body["pool"]), "Move sofa") != "restricted_for_all" {
			t.Fatalf("body = %s", r.Raw)
		}
	}
}

func TestAnOverdueTaskWaitsForADayItsChoreAllows(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	// No Energy on Tuesday, when the Task opens; plenty afterwards.
	apitest.SetBaseline(t, me, map[string]any{"tuesday": 0, "wednesday": 5})
	apitest.AtDay(app, 3)
	apitest.CreateChore(t, me, apitest.Chore("Garden", 1, 2, "normal", []string{}, 2)) // Tuesdays only
	app.RunAllocation(t)

	apitest.AtDay(app, 4) // Wednesday: the Task is overdue and there is Energy, but the day is forbidden.
	app.RunAllocation(t)
	if r := dayPlan(t, me); len(taskList(t, r.Body["mine"])) != 0 || reasonOf(taskList(t, r.Body["pool"]), "Garden") != "weekday_not_allowed" {
		t.Fatalf("Wednesday: %s", r.Raw)
	}
}

func TestYesterdaysUnfinishedTasksAreCandidatesAgain(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 3, "tuesday": 0, "wednesday": 3})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Laundry", 1, 3, "normal", []string{}))

	// Monday: assigned, then left undone
	app.RunAllocation(t)
	if got := names(taskList(t, dayPlan(t, me).Body["mine"])); len(got) != 1 {
		t.Fatalf("Monday: mine = %v", got)
	}

	apitest.AtDay(app, 3) // Tuesday: Energy 0. Yesterday's assignment is not today's plan,
	app.RunAllocation(t)
	r := dayPlan(t, me) // and the overdue Task is in the pool.
	if len(taskList(t, r.Body["mine"])) != 0 || reasonOf(taskList(t, r.Body["pool"]), "Laundry") != "no_energy_left" {
		t.Fatalf("Tuesday: %s", r.Raw)
	}

	apitest.AtDay(app, 4) // Wednesday: the same Task is a candidate again and fits.
	app.RunAllocation(t)
	if got := names(taskList(t, dayPlan(t, me).Body["mine"])); len(got) != 1 || got[0] != "Laundry" {
		t.Fatalf("Wednesday: mine = %v", got)
	}
}

func TestADayPlanNeverShowsAnotherHomesTasks(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.HomeWithResident(t, app, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, a, apitest.Chore("A's chore", 7, 1, "normal", []string{}))
	app.RunAllocation(t)

	r := dayPlan(t, b)
	if r.Body["planned"] != true { // B's Home was planned too, with nothing in it
		t.Fatalf("B: %s", r.Raw)
	}
	if len(taskList(t, r.Body["mine"]))+len(taskList(t, r.Body["pool"]))+len(taskList(t, r.Body["others"])) != 0 {
		t.Fatalf("B sees A's Home: %s", r.Raw)
	}
}

func categoriesOf(tasks []map[string]any) map[any]any {
	out := map[any]any{}
	for _, tk := range tasks {
		out[tk["choreName"]] = tk["category"]
	}
	return out
}

func TestDayPlanTasksCarryTheirChoresCategory(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	other := apitest.ExtraResident(t, app, me, "b@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 3})
	apitest.SetBaseline(t, other, map[string]any{"monday": 2})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 3, "essential", []string{})) // kitchen
	pets := apitest.Chore("Feed the cat", 7, 2, "normal", []string{})
	pets["category"] = "pets"
	apitest.CreateChore(t, me, pets)

	apitest.Pool(t, me) // open the Tasks without planning
	before := categoriesOf(taskList(t, dayPlan(t, me).Body["pool"]))
	if len(before) != 2 || before["Dishes"] != "kitchen" || before["Feed the cat"] != "pets" {
		t.Fatalf("pool before the run = %v", before)
	}

	app.RunAllocation(t)
	r := dayPlan(t, me)
	if got := categoriesOf(taskList(t, r.Body["mine"])); len(got) != 1 || got["Dishes"] != "kitchen" {
		t.Fatalf("mine = %v, want Dishes in kitchen: %s", got, r.Raw)
	}
	others := taskList(t, r.Body["others"])
	if len(others) != 1 {
		t.Fatalf("others = %v, want one Resident: %s", others, r.Raw)
	}
	if got := categoriesOf(taskList(t, others[0]["tasks"])); len(got) != 1 || got["Feed the cat"] != "pets" {
		t.Fatalf("others tasks = %v, want Feed the cat in pets: %s", got, r.Raw)
	}
}

func TestDayPlanPoolTasksCarryTheirChoresCategoryAfterTheRun(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 3})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 3, "essential", []string{}))
	pets := apitest.Chore("Feed the cat", 7, 2, "normal", []string{})
	pets["category"] = "pets"
	apitest.CreateChore(t, me, pets)

	app.RunAllocation(t)
	r := dayPlan(t, me)
	if got := categoriesOf(taskList(t, r.Body["pool"])); len(got) != 1 || got["Feed the cat"] != "pets" {
		t.Fatalf("pool = %v, want Feed the cat in pets: %s", got, r.Raw)
	}
}

func TestTheDayPlanNeedsAHomeAndAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	if r := app.Get("/home/day-plan"); r.Status != http.StatusUnauthorized {
		t.Errorf("no token = %d, want 401", r.Status)
	}
	r := app.SignInAs("nohome@example.com").Get("/home/day-plan")
	if r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Errorf("no home = %d %s, want 404 no home", r.Status, r.Raw)
	}
}

func TestEveryRunIsRecordedWithItsAllocatorAndReasons(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 3})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 3, "essential", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Mop", 7, 3, "normal", []string{}))
	app.RunAllocation(t)

	var allocator, outcome string
	var date string
	var assigned, pooled int
	err := app.DB.QueryRow(context.Background(), `
		SELECT allocator, outcome, plan_date::text,
		       jsonb_array_length(reasons -> 'assigned'), jsonb_array_length(reasons -> 'pool')
		FROM allocation_runs`).Scan(&allocator, &outcome, &date, &assigned, &pooled)
	if err != nil {
		t.Fatal(err)
	}
	if allocator != "baseline" || outcome != "planned" || date != "2026-03-02" || assigned != 1 || pooled != 1 {
		t.Fatalf("run = %s %s %s assigned=%d pooled=%d", allocator, outcome, date, assigned, pooled)
	}
}
