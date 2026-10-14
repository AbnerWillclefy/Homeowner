package server_test

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func planMe(t *testing.T, c *apitest.Client) apitest.Response {
	t.Helper()
	return c.Post("/home/day-plan/me", nil)
}

// snapshot is every assignment row as text, sorted, leaving out one Resident's.
func snapshot(t *testing.T, app *apitest.App, exceptResident string) []string {
	t.Helper()
	rows, err := app.DB.Query(context.Background(), `
		SELECT run_id::text || '|' || task_id::text || '|' || resident_id::text || '|' || reason
		FROM day_plan_assignments WHERE resident_id::text <> $1 ORDER BY 1`, exceptResident)
	if err != nil {
		t.Fatal(err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func runRow(t *testing.T, app *apitest.App) string {
	t.Helper()
	var s string
	err := app.DB.QueryRow(context.Background(),
		`SELECT id::text || '|' || allocator || '|' || created_at::text || '|' || outcome FROM allocation_runs`).Scan(&s)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

type failing struct{}

func (failing) Name() string { return "stub" }
func (failing) Plan(allocation.State) (allocation.Result, error) {
	return allocation.Result{}, errors.New("boom")
}

func TestGetMyTasksRightAwayPlansTheCallerFromThePool(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com") // no Baseline yet: 0 Energy
	app.Clock.Set(mondayAt(6))
	for _, n := range []string{"One", "Two", "Three"} {
		createChore(t, me, chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t) // the day is planned while they had no Energy
	if got := len(taskList(t, dayPlan(t, me).Body["mine"])); got != 0 {
		t.Fatalf("setup: mine = %d", got)
	}

	setBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(9))
	r := planMe(t, me)
	if r.Status != http.StatusOK || r.Body["planned"] != true || r.Body["energy"] != float64(5) {
		t.Fatalf("POST = %d %s", r.Status, r.Raw)
	}
	mine := taskList(t, r.Body["mine"])
	if len(mine) != 2 || effortSum(mine) > 5 {
		t.Fatalf("mine = %s", r.Raw)
	}
	if r.Body["allocationTime"] != "07:00" {
		t.Fatalf("not the Day Plan body: %s", r.Raw)
	}
	if got := string(dayPlan(t, me).Raw); got != string(r.Raw) {
		t.Fatalf("GET differs from the answer:\n%s\n%s", got, r.Raw)
	}
}

func TestRightAwayTakesFromThePoolOnlyAndLeavesOthersAsTheyWere(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	b := extraResident(t, app, a, "b@example.com")
	setBaseline(t, a, map[string]any{"monday": 5})
	setBaseline(t, b, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		createChore(t, a, chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t) // 2 + 2 Tasks planned, 1 left in the pool
	aID := dayPlan(t, b).Body["others"].([]any)[0].(map[string]any)["residentId"].(string)
	bBefore := names(taskList(t, dayPlan(t, b).Body["mine"]))
	bRows := snapshot(t, app, aID)
	run := runRow(t, app)

	setBaseline(t, a, map[string]any{"monday": 10})
	app.Clock.Set(mondayAt(9))
	r := planMe(t, a)
	mine := names(taskList(t, r.Body["mine"]))
	if r.Status != http.StatusOK || len(mine) != 3 {
		t.Fatalf("POST = %d %s, want their 2 plus the pooled one", r.Status, r.Raw)
	}
	for _, n := range mine {
		if slices.Contains(bBefore, n) {
			t.Fatalf("took %s from the other Resident: %s", n, r.Raw)
		}
	}
	if len(taskList(t, r.Body["pool"])) != 0 {
		t.Fatalf("pool not drained: %s", r.Raw)
	}
	if got := names(taskList(t, dayPlan(t, b).Body["mine"])); !slices.Equal(got, bBefore) {
		t.Fatalf("B's view changed from %v to %v", bBefore, got)
	}
	if got := snapshot(t, app, aID); !slices.Equal(got, bRows) {
		t.Fatalf("other Residents' rows changed:\n%v\n%v", bRows, got)
	}
	if got := runRow(t, app); got != run {
		t.Fatalf("the run changed: %s -> %s", run, got)
	}
}

func TestRightAwayInANewHomeRefreshesTheTasksAndMakesTodaysRun(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(5)) // before the Allocation time, no tick yet
	createChore(t, me, chore("Dishes", 7, 2, "essential", []string{}))
	createChore(t, me, chore("Mop", 7, 2, "normal", []string{}))
	if runCount(t, app) != 0 {
		t.Fatal("setup: a run exists")
	}

	r := planMe(t, me)
	if r.Status != http.StatusOK || r.Body["planned"] != true || len(taskList(t, r.Body["mine"])) != 2 {
		t.Fatalf("POST = %d %s", r.Status, r.Raw)
	}
	if runCount(t, app) != 1 {
		t.Fatalf("%d runs, want today's", runCount(t, app))
	}
	app.Clock.Set(mondayAt(7))
	if sum := app.RunAllocation(t); sum.Planned != 0 || sum.Due != 0 {
		t.Fatalf("the job planned the Home again: %+v", sum)
	}
	if runCount(t, app) != 1 {
		t.Fatal("a second run appeared")
	}
}

func TestRightAwayTwiceGivesTheSameAnswer(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(5))
	for _, n := range []string{"One", "Two", "Three"} {
		createChore(t, me, chore(n, 7, 2, "normal", []string{}))
	}
	first := planMe(t, me)
	second := planMe(t, me)
	if second.Status != http.StatusOK || string(first.Raw) != string(second.Raw) {
		t.Fatalf("answers differ:\n%s\n%s", first.Raw, second.Raw)
	}
}

func TestRightAwayOnARejectedDayChangesNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com") // no Baseline: overEnergy breaks a rule
	app.Clock.Set(mondayAt(6))
	createChore(t, me, chore("Dishes", 7, 2, "normal", []string{}))
	app.UseAllocator(overEnergy{})
	app.Clock.Set(mondayAt(7))
	if sum := app.RunAllocation(t); sum.Rejected != 1 {
		t.Fatalf("setup: %+v", sum)
	}
	run := runRow(t, app)

	r := planMe(t, me)
	if r.Status != http.StatusOK || r.Body["rejected"] != true || len(taskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("POST = %d %s", r.Status, r.Raw)
	}
	if n := len(snapshot(t, app, "")); n != 0 || runRow(t, app) != run {
		t.Fatalf("a rejected day changed: %d assignments", n)
	}
}

func TestRightAwayWithABadProposalIs500AndStoresNothing(t *testing.T) {
	t.Parallel()
	for name, al := range map[string]allocation.Allocator{"error": failing{}, "refused": overEnergy{}} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app := apitest.Start(t)
			me := homeWithResident(t, app, "a@example.com") // no Baseline, so overEnergy is refused
			app.Clock.Set(mondayAt(6))
			createChore(t, me, chore("Dishes", 7, 2, "normal", []string{}))

			// No run yet: the run that would be made is rolled back too.
			app.UseAllocator(al)
			if r := planMe(t, me); r.Status != http.StatusInternalServerError {
				t.Fatalf("POST = %d %s, want 500", r.Status, r.Raw)
			}
			if runCount(t, app) != 0 {
				t.Fatal("a run was left behind")
			}

			// A planned run keeps its rows.
			app.UseAllocator(allocation.Baseline{})
			setBaseline(t, me, map[string]any{"monday": 5})
			app.Clock.Set(mondayAt(7))
			app.RunAllocation(t)
			before, run := snapshot(t, app, ""), runRow(t, app)
			setBaseline(t, me, map[string]any{"monday": 0})
			app.UseAllocator(al)
			if r := planMe(t, me); r.Status != http.StatusInternalServerError {
				t.Fatalf("POST = %d %s, want 500", r.Status, r.Raw)
			}
			if !slices.Equal(snapshot(t, app, ""), before) || runRow(t, app) != run {
				t.Fatal("the failed call changed the plan")
			}
		})
	}
}

func TestRightAwayWithNoEnergyIsAnEmptyPlanAndTheReasonStays(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com") // no Baseline for Monday
	app.Clock.Set(mondayAt(8))
	createChore(t, me, chore("Dishes", 7, 2, "essential", []string{}))
	r := planMe(t, me)
	if r.Status != http.StatusOK || r.Body["planned"] != true || r.Body["energy"] != float64(0) || len(taskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("POST = %d %s", r.Status, r.Raw)
	}
	if reasonOf(taskList(t, r.Body["pool"]), "Dishes") != "no_energy_left" {
		t.Fatalf("pool = %s", r.Raw)
	}
}

func TestRightAwayNeedsASignedInResidentWithAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	if r := app.Post("/home/day-plan/me", nil); r.Status != http.StatusUnauthorized {
		t.Fatalf("no token = %d %s", r.Status, r.Raw)
	}
	nohome := app.SignInAs("nohome@example.com")
	if r := planMe(t, nohome); r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Fatalf("no home = %d %s", r.Status, r.Raw)
	}
}

func TestRightAwayRacingTheJobLeavesOneRunAndNoDuplicates(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 10})
	app.Clock.Set(mondayAt(6))
	for _, n := range []string{"One", "Two", "Three"} {
		createChore(t, me, chore(n, 7, 3, "normal", []string{}))
	}
	app.Clock.Set(mondayAt(7))

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			app.Planner.RunDue(context.Background(), app.Clock.Now()) //nolint:errcheck
		}()
		go func() {
			defer wg.Done()
			if r := planMe(t, me); r.Status != http.StatusOK {
				t.Errorf("POST = %d %s", r.Status, r.Raw)
			}
		}()
	}
	wg.Wait()

	if got := runCount(t, app); got != 1 {
		t.Fatalf("%d runs, want 1", got)
	}
	if rows := snapshot(t, app, ""); len(rows) != 3 {
		t.Fatalf("assignments = %v, want 3 distinct", rows)
	}
}

func TestRightAwayLogsCarryOnlyIdsAndCounts(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "secret.person@example.com")
	setBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(8))
	createChore(t, me, chore("Scrub the secret sink", 7, 2, "normal", []string{}))
	planMe(t, me)
	logs := app.Logs.String()
	if !app.Logs.Contains("resident planned right away") {
		t.Fatalf("no log line:\n%s", logs)
	}
	for _, leak := range []string{"secret.person", "secret sink"} {
		if strings.Contains(logs, leak) {
			t.Fatalf("log leaks %q:\n%s", leak, logs)
		}
	}
}
