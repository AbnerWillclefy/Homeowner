package residents_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// PATCH /home/completions/{id}: a Resident re-dates a Completion (ADR 0018).

func move(c *apitest.Client, id string, at time.Time) apitest.Response {
	return c.Do(http.MethodPatch, "/home/completions/"+id, map[string]any{"completedAt": at.Format(time.RFC3339)}, nil)
}

func wantMoveError(t *testing.T, res apitest.Response, status int, code string) {
	t.Helper()
	if res.Status != status || res.Body["error"] != code {
		t.Fatalf("PATCH = %d %s, want %d %s", res.Status, res.Raw, status, code)
	}
}

// completionOf is the id of the Completion of a Task.
func completionOf(t *testing.T, app *apitest.App, task string) string {
	t.Helper()
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM completions WHERE task_id = $1`, task).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// stored is the three columns a move writes, in one read.
func stored(t *testing.T, app *apitest.App, task string) string {
	t.Helper()
	var s string
	err := app.DB.QueryRow(context.Background(), `
		SELECT k.completed_at::text || ' ' || k.completed_on::text || ' ' || t.closed_on::text
		FROM completions k JOIN tasks t ON t.id = k.task_id WHERE t.id = $1`, task).Scan(&s)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// doneOn plans the day of at, completes the first Task of c at at and returns
// the Task id.
func doneOn(t *testing.T, app *apitest.App, c *apitest.Client, at time.Time) string {
	t.Helper()
	id := planAt(t, app, c, at.Truncate(24*time.Hour).Add(7*time.Hour))[0]
	completeAt(t, app, c, id, at)
	return id
}

func TestMoveNeedsATokenAndAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.ExpectStatus(t, app.Do(http.MethodPatch, "/home/completions/"+unknownID, nil), http.StatusUnauthorized)
	res := move(app.SignInAs("a@example.com"), unknownID, apitest.MondayAt(9))
	wantMoveError(t, res, http.StatusNotFound, "no home")
}

func TestMoveAnswersTheSame404ForMalformedUnknownAndForeignIDs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	other := apitest.HomeWithResident(t, app, "other@example.com")
	foreign := completionOf(t, app, doneOn(t, app, a, apitest.MondayAt(9)))

	for _, id := range []string{"not-a-uuid", unknownID, foreign} {
		wantMoveError(t, move(other, id, apitest.MondayAt(9)), http.StatusNotFound, "completion not found")
	}
	base := app.QueriesFor(func() { a.Get("/home") })
	if got := app.QueriesFor(func() { move(a, "not-a-uuid", apitest.MondayAt(9)) }); got != base {
		t.Errorf("malformed id ran %d queries, GET /home runs %d; want equal", got, base)
	}
}

func TestMoveRejectsABodyWithoutAValidInstant(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	id := completionOf(t, app, doneOn(t, app, a, apitest.MondayAt(9)))

	for _, body := range []any{map[string]any{}, map[string]any{"completedAt": ""}, map[string]any{"completedAt": "yesterday"}, map[string]any{"completedAt": "2026-03-01"}} {
		res := a.Do(http.MethodPatch, "/home/completions/"+id, body, nil)
		wantMoveError(t, res, http.StatusBadRequest, "invalid_completed_at")
	}
	if res := a.SendRaw(http.MethodPatch, "/home/completions/"+id, nil); res.Status != http.StatusBadRequest {
		t.Errorf("no body = %d %s, want 400", res.Status, res.Raw)
	}
}

func TestMoveIsForTheResidentsNamedOnTheCompletion(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	cs := dailyHome(t, app, "a@example.com", "b@example.com")
	id := completionOf(t, app, doneOn(t, app, cs[0], apitest.MondayAt(9)))
	wantMoveError(t, move(cs[1], id, apitest.MondayAt(8)), http.StatusConflict, "not_yours")
}

func TestMovingATwoPersonCompletionMovesItForBothAndEitherMayMoveIt(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 4, 4)
	app.Clock.Set(apitest.MondayAt(9))
	task := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, b, "complete", task)
	id := completionOf(t, app, task)

	app.Clock.Set(apitest.MondayAt(12))
	apitest.ExpectStatus(t, move(a, id, apitest.MondayAt(8)), http.StatusOK)
	apitest.ExpectStatus(t, move(b, id, apitest.MondayAt(7).Add(30*time.Minute)), http.StatusOK)
	for _, c := range []*apitest.Client{a, b} {
		days := daysOf(t, detailOf(t, c, ownID(t, c)))
		k := apitest.TaskList(t, days[0]["completions"])
		if len(k) != 1 || k[0]["completedAt"] != "2026-03-02T07:30:00Z" {
			t.Errorf("a partner sees %v, want the Completion at 07:30", k)
		}
	}
}

func TestMoveReadsTheInstantAsAHomeLocalDateAndBoundsIt(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("America/Sao_Paulo", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	apitest.SetBaseline(t, me, allWeek(4))
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	app.Clock.Set(time.Date(2026, 2, 1, 6, 0, 0, 0, loc)) // so the Task's window opens before today-29
	for _, n := range []string{"Alpha", "Beta", "Gamma"} {
		apitest.CreateChore(t, me, apitest.Chore(n, 1, 2, "normal", []string{}))
	}
	now := time.Date(2026, 3, 10, 12, 0, 0, 0, loc)
	task := planAt(t, app, me, time.Date(2026, 3, 10, 7, 0, 0, 0, loc))[0]
	completeAt(t, app, me, task, now)
	id := completionOf(t, app, task)

	wantMoveError(t, move(me, id, now.Add(time.Second)), http.StatusBadRequest, "in_future")
	apitest.ExpectStatus(t, move(me, id, now), http.StatusOK)

	oldest := time.Date(2026, 2, 9, 0, 0, 0, 0, loc) // today-29
	wantMoveError(t, move(me, id, oldest.Add(-time.Second)), http.StatusBadRequest, "too_old")
	apitest.ExpectStatus(t, move(me, id, oldest), http.StatusOK)

	// 23:30 local on the 9th is 02:30 UTC on the 10th: it counts for the 9th.
	res := move(me, id, time.Date(2026, 3, 9, 23, 30, 0, 0, loc))
	apitest.ExpectStatus(t, res, http.StatusOK)
	if days := daysOf(t, res); len(days) != 1 || days[0]["date"] != "2026-03-09" {
		t.Errorf("days = %s, want the Completion on 2026-03-09", res.Raw)
	}
	if got := stored(t, app, task); !strings.Contains(got, " 2026-03-09 2026-03-09") {
		t.Errorf("stored = %s, want completed_on and closed_on 2026-03-09", got)
	}
}

func TestMoveBeforeTheTaskWindowChangesNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	task := doneOn(t, app, a, apitest.MondayAt(9))
	before := stored(t, app, task)

	wantMoveError(t, move(a, completionOf(t, app, task), apitest.MondayAt(9).AddDate(0, 0, -1)), http.StatusBadRequest, "before_task")
	if after := stored(t, app, task); after != before {
		t.Errorf("a rejected move changed %q to %q", before, after)
	}
}

func TestMoveRedatesTheCompletionTheTaskAndEveryReadModel(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	doneOn(t, app, a, apitest.MondayAt(9))
	tuesday := doneOn(t, app, a, apitest.MondayAt(9).AddDate(0, 0, 1))
	id := completionOf(t, app, tuesday)

	res := move(a, id, apitest.MondayAt(20))
	apitest.ExpectStatus(t, res, http.StatusOK)
	if res.Body["you"] != true || res.Body["doneLast7Days"] != float64(2) {
		t.Errorf("body = %s, want the caller's detail with both Completions", res.Raw)
	}
	if days := daysOf(t, res); len(days) != 1 || days[0]["date"] != "2026-03-02" || len(apitest.TaskList(t, days[0]["completions"])) != 2 {
		t.Errorf("days = %s, want both on 2026-03-02", res.Raw)
	}
	if got := stored(t, app, tuesday); got != "2026-03-02 20:00:00+00 2026-03-02 2026-03-02" {
		t.Errorf("stored = %q", got)
	}
	if done := apitest.TaskList(t, apitest.DayPlan(t, a).Body["doneToday"]); len(done) != 0 {
		t.Errorf("doneToday still lists the moved card: %v", done)
	}
	if got := listOf(t, a).Residents[0].DoneToday; got != 0 {
		t.Errorf("list doneToday = %d, want 0", got)
	}
}

// The Streak regression of ADR 0018: a Task Committed on Tuesday, completed,
// then moved to Monday is not an undone Tuesday.
func TestMovingACommittedTaskBackDoesNotBreakTheStreak(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	doneOn(t, app, a, apitest.MondayAt(9))
	tue := planAt(t, app, a, apitest.MondayAt(7).AddDate(0, 0, 1))[0]
	app.Clock.Set(apitest.MondayAt(9).AddDate(0, 0, 1))
	apitest.MustAct(t, a, "accept", tue)
	apitest.MustAct(t, a, "complete", tue)
	apitest.ExpectStatus(t, move(a, completionOf(t, app, tue), apitest.MondayAt(20)), http.StatusOK)

	app.Clock.Set(apitest.MondayAt(9).AddDate(0, 0, 2))
	if res := a.Get("/home/streak"); res.Body["current"] != float64(1) {
		t.Errorf("GET /home/streak = %s, want 1 (Monday grew, Tuesday paused)", res.Raw)
	}
}

func TestMovingTheLatestTasksCompletionEarlierOpensTheNextTaskFromTheNewDate(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	task := doneOn(t, app, a, apitest.MondayAt(9).AddDate(0, 0, 1))
	apitest.ExpectStatus(t, move(a, completionOf(t, app, task), apitest.MondayAt(20)), http.StatusOK)

	if res := a.Get("/home/tasks"); res.Status != http.StatusOK {
		t.Fatalf("GET /home/tasks = %d %s", res.Status, res.Raw)
	}
	var windowStart string
	err := app.DB.QueryRow(context.Background(), `
		SELECT max(t.window_start)::text FROM tasks t WHERE t.chore_id = (SELECT chore_id FROM tasks WHERE id = $1)`, task).Scan(&windowStart)
	if err != nil || windowStart != "2026-03-03" {
		t.Errorf("next Task window_start = %q, %v; want 2026-03-03 (the day after the new closed_on)", windowStart, err)
	}
}
