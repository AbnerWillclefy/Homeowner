package dayplan_test

import (
	"bytes"
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestCompleteRecordsTheCompletionWithTheResidentAndTheTime(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	app.Clock.Set(apitest.MondayAt(11))
	task := apitest.MineOf(t, a)[0]
	name := task["choreName"].(string)

	r := apitest.MustAct(t, a, "complete", task["id"].(string))
	if reasonOf(apitest.TaskList(t, r.Body["mine"]), name) != "missing" {
		t.Fatalf("a done Task is still in mine: %s", r.Raw)
	}
	done := apitest.TaskList(t, r.Body["doneToday"])
	if len(done) != 1 || done[0]["id"] != task["id"] || done[0]["choreName"] != name || done[0]["completedAt"] != "2026-03-02T11:00:00Z" {
		t.Fatalf("doneToday = %s", r.Raw)
	}
	if got := apitest.TaskList(t, apitest.DayPlan(t, b).Body["doneToday"]); len(got) != 0 {
		t.Fatalf("B sees A's Completion: %v", got)
	}
	// A one-person Task says "with": [] (never null, never missing).
	if !bytes.Contains(r.Raw, []byte(`"with":[]`)) {
		t.Fatalf("doneToday[0].with is not []: %s", r.Raw)
	}

	var (
		at     time.Time
		on     string
		who    []string
		status string
	)
	ctx := context.Background()
	err := app.DB.QueryRow(ctx, `
		SELECT c.completed_at, c.completed_on::text, t.status FROM completions c JOIN tasks t ON t.id = c.task_id
		WHERE c.task_id = $1`, task["id"]).Scan(&at, &on, &status)
	if err != nil {
		t.Fatal(err)
	}
	if !at.Equal(apitest.MondayAt(11)) || on != "2026-03-02" || status != "done" {
		t.Fatalf("completion at %v on %s, task %s", at, on, status)
	}
	rows, err := app.DB.Query(ctx, `
		SELECT u.email FROM completion_residents cr JOIN completions c ON c.id = cr.completion_id
		JOIN residents r ON r.id = cr.resident_id JOIN users u ON u.id = r.user_id WHERE c.task_id = $1`, task["id"])
	if err != nil {
		t.Fatal(err)
	}
	if who, err = pgx.CollectRows(rows, pgx.RowTo[string]); err != nil || len(who) != 1 || who[0] != "a@example.com" {
		t.Fatalf("completion residents = %v, %v, want only A", who, err)
	}
}

func TestCompleteWorksOnAnAcceptedTaskAndTwiceIsAlreadyDone(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	id := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", id)
	apitest.MustAct(t, a, "complete", id)
	wantConflict(t, apitest.Act(a, "complete", id), "already_done")
	wantConflict(t, apitest.Act(a, "accept", id), "already_done")
	wantConflict(t, apitest.Act(a, "refuse", id), "already_done")
	if got := apitest.Count(t, app, `SELECT count(*) FROM completions`); got != 1 {
		t.Fatalf("%d completions, want 1", got)
	}
}

func TestCompleteNeedsTheCallerToHoldTheTask(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	other := apitest.MineOf(t, b)
	wantConflict(t, apitest.Act(a, "complete", other[0]["id"].(string)), "not_yours")
	apitest.MustAct(t, b, "accept", other[1]["id"].(string))
	wantConflict(t, apitest.Act(a, "complete", other[1]["id"].(string)), "not_yours")
	if got := apitest.Count(t, app, `SELECT count(*) FROM completions`); got != 0 {
		t.Fatalf("%d completions", got)
	}
}

func TestCompleteWithoutATodayPlanIsNoPlanToday(t *testing.T) {
	t.Parallel()
	_, me := planned(t, 5, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, apitest.Act(me, "complete", apitest.Pool(t, me)[0]["id"].(string)), "no_plan_today")
}

func TestCompleteTakesAPoolTaskAndCompletesItInOneStep(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	pooled := apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"])[0]
	id, name := pooled["id"].(string), pooled["choreName"].(string)

	r := apitest.MustAct(t, a, "complete", id)
	done := apitest.TaskList(t, r.Body["doneToday"])
	if len(done) != 1 || done[0]["id"] != id || done[0]["choreName"] != name {
		t.Fatalf("doneToday = %s", r.Raw)
	}
	if len(apitest.TaskList(t, r.Body["pool"])) != 0 {
		t.Fatalf("still in the pool: %s", r.Raw)
	}
	counts := []struct {
		query string
		want  int
	}{
		{`SELECT count(*) FROM completions WHERE task_id = $1`, 1},
		{`SELECT count(*) FROM completion_residents cr JOIN completions c ON c.id = cr.completion_id WHERE c.task_id = $1`, 1},
		{`SELECT count(*) FROM completion_residents cr JOIN completions c ON c.id = cr.completion_id
			JOIN residents r ON r.id = cr.resident_id JOIN users u ON u.id = r.user_id
			WHERE c.task_id = $1 AND u.email = 'a@example.com'`, 1},
		{`SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, 1},
		{`SELECT count(*) FROM day_plan_assignments WHERE task_id = $1 AND reason = 'taken'`, 1},
	}
	for _, c := range counts {
		if got := apitest.Count(t, app, c.query, id); got != c.want {
			t.Errorf("%d rows, want %d: %s", got, c.want, c.query)
		}
	}
	s := a.Get("/home/streak")
	apitest.ExpectStatus(t, s, http.StatusOK)
	if s.Body["todayGrew"] != true || s.Body["current"] != float64(1) {
		t.Fatalf("streak = %s", s.Raw)
	}
	// A second complete of the same Task finds it done.
	wantConflict(t, apitest.Act(a, "complete", id), "already_done")
}

func TestCompleteOnAPoolTaskNeverBreaksARestriction(t *testing.T) {
	t.Parallel()
	app, me := planned(t, 10, apitest.Chore("Move sofa", 7, 2, "normal", []string{"heavy_lifting"}))
	apitest.ExpectStatus(t, me.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
	allocate(app, t)
	before := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`)
	wantConflict(t, apitest.Act(me, "complete", apitest.Pool(t, me)[0]["id"].(string)), "restricted")
	wantNothingWritten(t, app, before)
}

func TestCompleteCannotFinishATwoPersonPoolTask(t *testing.T) {
	t.Parallel()
	two := apitest.Chore("Move bed", 7, 2, "normal", []string{})
	two["people"] = 2
	app, me := planned(t, 10, two)
	allocate(app, t)
	before := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`)
	wantConflict(t, apitest.Act(me, "complete", apitest.Pool(t, me)[0]["id"].(string)), "two_person_task")
	wantNothingWritten(t, app, before)
}

func TestCompleteOnAPoolTaskRefusesADrainedResident(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	apitest.CheckIn(t, a, "drained")
	pool := apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"])
	if len(pool) == 0 {
		t.Fatal("setup: empty pool")
	}
	before := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`)
	wantConflict(t, apitest.Act(a, "complete", pool[0]["id"].(string)), "drained")
	wantNothingWritten(t, app, before)
}

func wantNothingWritten(t *testing.T, app *apitest.App, assignments int) {
	t.Helper()
	for _, table := range []string{"completions", "task_residents"} {
		if got := apitest.Count(t, app, `SELECT count(*) FROM `+table); got != 0 {
			t.Errorf("%d rows in %s, want 0", got, table)
		}
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`); got != assignments {
		t.Errorf("%d assignments, want %d", got, assignments)
	}
}

func TestCompletedOnIsTheHomesLocalDateNotUTCs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("America/Los_Angeles", "07:00")); r.Status != 201 {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	apitest.SetBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(time.Date(2026, time.March, 2, 14, 0, 0, 0, time.UTC)) // 06:00 Monday in Los Angeles
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.Clock.Set(time.Date(2026, time.March, 2, 15, 0, 0, 0, time.UTC)) // 07:00
	app.RunAllocation(t)

	// 19:00 Monday in Los Angeles is already Tuesday in UTC.
	app.Clock.Set(time.Date(2026, time.March, 3, 3, 0, 0, 0, time.UTC))
	r := apitest.MustAct(t, me, "complete", apitest.MineOf(t, me)[0]["id"].(string))
	if r.Body["date"] != "2026-03-02" || len(apitest.TaskList(t, r.Body["doneToday"])) != 1 {
		t.Fatalf("body = %s", r.Raw)
	}
	var on, closed string
	if err := app.DB.QueryRow(context.Background(), `
		SELECT c.completed_on::text, t.closed_on::text FROM completions c JOIN tasks t ON t.id = c.task_id`).Scan(&on, &closed); err != nil {
		t.Fatal(err)
	}
	if on != "2026-03-02" || closed != "2026-03-02" {
		t.Fatalf("completed_on = %s, closed_on = %s, want the Home's 2 March", on, closed)
	}
}

func TestACompletedBuildUpChoreReturnsAtBaseEffort(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5})
	apitest.AtDay(app, 1)
	apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 4, 2, true))
	apitest.AtDay(app, 9) // Monday: it has built up to 4
	app.RunAllocation(t)
	mine := apitest.MineOf(t, me)
	if len(mine) != 1 || mine[0]["currentEffort"] != float64(4) {
		t.Fatalf("setup: %s", apitest.DayPlan(t, me).Raw)
	}
	apitest.MustAct(t, me, "complete", mine[0]["id"].(string))

	apitest.AtDay(app, 13)
	l := apitest.Pool(t, me)
	if len(l) != 1 || l[0]["currentEffort"] != float64(2) || l[0]["windowStart"] != "2026-03-13" {
		t.Fatalf("pool = %v, want a new Task at base Effort from 13 March", l)
	}
}
