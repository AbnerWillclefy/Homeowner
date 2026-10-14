package dayplan_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestCompleteRecordsTheCompletionWithTheResidentAndTheTime(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	app.Clock.Set(mondayAt(11))
	task := mineOf(t, a)[0]
	name := task["choreName"].(string)

	r := mustAct(t, a, "complete", task["id"].(string))
	if reasonOf(taskList(t, r.Body["mine"]), name) != "missing" {
		t.Fatalf("a done Task is still in mine: %s", r.Raw)
	}
	done := taskList(t, r.Body["doneToday"])
	if len(done) != 1 || done[0]["id"] != task["id"] || done[0]["choreName"] != name || done[0]["completedAt"] != "2026-03-02T11:00:00Z" {
		t.Fatalf("doneToday = %s", r.Raw)
	}
	if got := taskList(t, dayPlan(t, b).Body["doneToday"]); len(got) != 0 {
		t.Fatalf("B sees A's Completion: %v", got)
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
	if !at.Equal(mondayAt(11)) || on != "2026-03-02" || status != "done" {
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
	app, a, _ := twoResidents(t)
	id := mineOf(t, a)[0]["id"].(string)
	mustAct(t, a, "accept", id)
	mustAct(t, a, "complete", id)
	wantConflict(t, act(a, "complete", id), "already_done")
	wantConflict(t, act(a, "accept", id), "already_done")
	wantConflict(t, act(a, "refuse", id), "already_done")
	if got := apitest.Count(t, app, `SELECT count(*) FROM completions`); got != 1 {
		t.Fatalf("%d completions, want 1", got)
	}
}

func TestCompleteNeedsTheCallerToHoldTheTask(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	wantConflict(t, act(a, "complete", mineOf(t, b)[0]["id"].(string)), "not_yours")
	wantConflict(t, act(a, "complete", taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)), "not_yours")
	if got := apitest.Count(t, app, `SELECT count(*) FROM completions`); got != 0 {
		t.Fatalf("%d completions", got)
	}
}

func TestCompleteWithoutATodayPlanIsNotYours(t *testing.T) {
	t.Parallel()
	_, me := planned(t, 5, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, act(me, "complete", apitest.Pool(t, me)[0]["id"].(string)), "not_yours")
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
	r := mustAct(t, me, "complete", mineOf(t, me)[0]["id"].(string))
	if r.Body["date"] != "2026-03-02" || len(taskList(t, r.Body["doneToday"])) != 1 {
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
	mine := mineOf(t, me)
	if len(mine) != 1 || mine[0]["currentEffort"] != float64(4) {
		t.Fatalf("setup: %s", dayPlan(t, me).Raw)
	}
	mustAct(t, me, "complete", mine[0]["id"].(string))

	apitest.AtDay(app, 13)
	l := apitest.Pool(t, me)
	if len(l) != 1 || l[0]["currentEffort"] != float64(2) || l[0]["windowStart"] != "2026-03-13" {
		t.Fatalf("pool = %v, want a new Task at base Effort from 13 March", l)
	}
}
