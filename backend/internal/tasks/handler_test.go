package tasks_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func countOpen(t *testing.T, app *apitest.App, choreID string) int {
	t.Helper()
	var n int
	err := app.DB.QueryRow(context.Background(),
		`SELECT count(*) FROM tasks WHERE chore_id = $1 AND status = 'open'`, choreID).Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPoolShowsTheFirstWindowOfANewChore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 10)
	id := apitest.CreateChore(t, me, apitest.Recurring("Wipe counters", 3, 2, false))

	got := apitest.Pool(t, me)
	if len(got) != 1 {
		t.Fatalf("pool = %v, want one Task", got)
	}
	task := got[0]
	if task["choreId"] != id || task["choreName"] != "Wipe counters" ||
		task["windowStart"] != "2026-03-10" || task["windowEnd"] != "2026-03-12" ||
		task["currentEffort"] != float64(2) || task["baseEffort"] != float64(2) ||
		task["people"] != float64(1) || task["importance"] != "normal" || task["id"] == "" {
		t.Fatalf("task = %v", task)
	}
}

func TestPoolTasksCarryTheirChoresCategory(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 10)
	apitest.CreateChore(t, me, apitest.Recurring("Wipe counters", 3, 2, false))
	pets := apitest.Recurring("Feed the cat", 3, 1, false)
	pets["category"] = "pets"
	apitest.CreateChore(t, me, pets)

	got := map[any]any{}
	for _, task := range apitest.Pool(t, me) {
		got[task["choreName"]] = task["category"]
	}
	if len(got) != 2 || got["Wipe counters"] != "kitchen" || got["Feed the cat"] != "pets" {
		t.Fatalf("categories = %v", got)
	}
}

func TestAnEmptyPoolIsAnEmptyArray(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	r := me.Get("/home/tasks")
	if r.Status != http.StatusOK || string(r.Raw) == "" || r.Body["tasks"] == nil {
		t.Fatalf("GET = %d %s, want {\"tasks\":[]}", r.Status, r.Raw)
	}
	if l := r.Body["tasks"].([]any); len(l) != 0 {
		t.Fatalf("tasks = %v", l)
	}
}

func TestPoolNeedsAHomeAndAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	if r := app.Get("/home/tasks"); r.Status != http.StatusUnauthorized {
		t.Errorf("no token = %d, want 401", r.Status)
	}
	if r := app.SignInAs("nohome@example.com").Get("/home/tasks"); r.Status != http.StatusNotFound {
		t.Errorf("no home = %d, want 404", r.Status)
	}
}

func TestResidentsOnlySeeTheirOwnHomesPool(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.HomeWithResident(t, app, "b@example.com")
	apitest.CreateChore(t, a, apitest.Recurring("A's chore", 3, 1, false))
	if l := apitest.Pool(t, b); len(l) != 0 {
		t.Fatalf("B sees A's pool: %v", l)
	}
	if l := apitest.Pool(t, a); len(l) != 1 {
		t.Fatalf("A pool = %v", l)
	}
}

// Walking the fake clock across windows: one Task per Chore stays open, the
// same row, with its original window, however often the pool is read.
func TestTheSameTaskStaysOpenAcrossMissedWindows(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	id := apitest.CreateChore(t, me, apitest.Recurring("Dust", 3, 2, false))
	other := apitest.CreateChore(t, me, apitest.Recurring("Sweep", 2, 1, false))

	first := apitest.Pool(t, me)
	taskID := map[string]string{}
	for _, tk := range first {
		taskID[tk["choreId"].(string)] = tk["id"].(string)
	}
	for day := 1; day <= 14; day++ {
		apitest.AtDay(app, day)
		for rep := 0; rep < 2; rep++ { // read twice at the same instant
			l := apitest.Pool(t, me)
			if len(l) != 2 {
				t.Fatalf("day %d: pool has %d Tasks, want 2", day, len(l))
			}
			for _, tk := range l {
				if tk["id"] != taskID[tk["choreId"].(string)] {
					t.Fatalf("day %d: a new Task replaced the open one: %v", day, tk)
				}
				if tk["windowStart"] != "2026-03-01" {
					t.Fatalf("day %d: window moved: %v", day, tk)
				}
			}
		}
		if n := countOpen(t, app, id) + countOpen(t, app, other); n != 2 {
			t.Fatalf("day %d: %d open Tasks, want 2", day, n)
		}
	}
}

func effortOf(t *testing.T, c *apitest.Client) (cur, base float64) {
	t.Helper()
	l := apitest.Pool(t, c)
	if len(l) != 1 {
		t.Fatalf("pool = %v", l)
	}
	return l[0]["currentEffort"].(float64), l[0]["baseEffort"].(float64)
}

func TestBuildUpEffortGrowsOnePerMissedWindowUpToFive(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 3, 2, true))

	for day, want := range map[int]float64{1: 2, 3: 2, 4: 3, 6: 3, 7: 4, 10: 5, 13: 5, 28: 5} {
		apitest.AtDay(app, day)
		cur, base := effortOf(t, me)
		if cur != want || base != 2 {
			t.Errorf("day %d: current %v base %v, want current %v base 2", day, cur, base, want)
		}
	}
	var base int
	if err := app.DB.QueryRow(context.Background(), `SELECT base_effort FROM chores`).Scan(&base); err != nil || base != 2 {
		t.Errorf("chore base effort = %d, %v; must stay 2", base, err)
	}
}

func TestBuildUpAfterAJumpEqualsSteppingDaily(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 2, 1, true))
	apitest.AtDay(app, 8) // three whole windows missed, no read in between
	if cur, _ := effortOf(t, me); cur != 4 {
		t.Fatalf("current effort = %v, want 4", cur)
	}
}

func TestChoreWithoutBuildUpNeverChangesEffort(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	apitest.CreateChore(t, me, apitest.Recurring("Dust", 1, 2, false))
	apitest.AtDay(app, 20)
	if cur, _ := effortOf(t, me); cur != 2 {
		t.Fatalf("current effort = %v, want 2", cur)
	}
}

func TestWeekdayLimitedChoreOnlyBecomesDueOnAllowedDays(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 4) // Wednesday
	// Monday (1) and Thursday (4).
	id := apitest.CreateChore(t, me, apitest.Recurring("Trash", 7, 1, false, 1, 4))

	for day := 4; day <= 24; day++ {
		apitest.AtDay(app, day)
		l := apitest.Pool(t, me)
		if day == 4 && len(l) != 0 {
			t.Fatalf("a Task was open on Wednesday, a disallowed day: %v", l)
		}
		if day == 5 && (len(l) != 1 || l[0]["windowStart"] != "2026-03-05") {
			t.Fatalf("Thursday 5: pool = %v, want the Task from 2026-03-05", l)
		}
	}
	rows, err := app.DB.Query(context.Background(),
		`SELECT extract(dow FROM window_start)::int FROM tasks WHERE chore_id = $1`, id)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		var dow int
		if err := rows.Scan(&dow); err != nil {
			t.Fatal(err)
		}
		n++
		if dow != 1 && dow != 4 {
			t.Errorf("a window starts on weekday %d", dow)
		}
	}
	if n == 0 {
		t.Fatal("no Task was ever opened")
	}
}

func TestWeekdayIsTakenInTheHomesTimezone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("America/Los_Angeles", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	// Created Sunday 8 March 20:00 local (PDT, already Monday 03:00 UTC).
	app.Clock.Set(time.Date(2026, time.March, 9, 3, 0, 0, 0, time.UTC))
	apitest.CreateChore(t, me, apitest.Recurring("Trash", 7, 1, false, 1)) // Monday only
	if l := apitest.Pool(t, me); len(l) != 0 {
		t.Fatalf("Tuesday in UTC... Sunday locally: pool = %v, want empty until local Monday", l)
	}
	app.Clock.Set(time.Date(2026, time.March, 9, 15, 0, 0, 0, time.UTC)) // Monday 08:00 local
	l := apitest.Pool(t, me)
	if len(l) != 1 || l[0]["windowStart"] != "2026-03-09" {
		t.Fatalf("pool = %v, want a Task from local Monday 2026-03-09", l)
	}
}

func TestOneOffChoreProducesExactlyOneTask(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	one := apitest.Recurring("Clean gutters", 1, 3, true)
	one["intervalDays"] = nil
	id := apitest.CreateChore(t, me, one)

	for day := 1; day <= 40; day++ {
		apitest.AtDay(app, day)
		if day == 12 {
			if _, err := app.DB.Exec(context.Background(),
				`UPDATE tasks SET status = 'done', closed_on = '2026-03-12' WHERE chore_id = $1`, id); err != nil {
				t.Fatal(err)
			}
		}
		l := apitest.Pool(t, me)
		apitest.Pool(t, me)
		if day < 12 && (len(l) != 1 || l[0]["currentEffort"] != float64(3)) {
			t.Fatalf("day %d: pool = %v", day, l)
		}
		if day >= 12 && len(l) != 0 {
			t.Fatalf("day %d: a finished one-off came back: %v", day, l)
		}
	}
	var n int
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM tasks WHERE chore_id = $1`, id).Scan(&n); err != nil || n != 1 {
		t.Fatalf("tasks ever created = %d, %v; want 1", n, err)
	}
}

func TestFinishedRecurringChoreComesBackAtBaseEffort(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	id := apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 4, 2, true))
	apitest.AtDay(app, 9)
	if cur, _ := effortOf(t, me); cur != 4 {
		t.Fatalf("current effort = %v, want 4", cur)
	}
	if _, err := app.DB.Exec(context.Background(),
		`UPDATE tasks SET status = 'done', closed_on = '2026-03-09' WHERE chore_id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if l := apitest.Pool(t, me); len(l) != 0 {
		t.Fatalf("pool right after closing = %v", l)
	}
	apitest.AtDay(app, 13)
	l := apitest.Pool(t, me)
	if len(l) != 1 || l[0]["currentEffort"] != float64(2) || l[0]["windowStart"] != "2026-03-13" {
		t.Fatalf("pool = %v, want a new Task at base Effort from 13 March", l)
	}
}

func TestDatabaseRejectsATaskDoneWithoutAClosingDateOrOpenWithOne(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 4)
	id := apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 4, 2, true))
	if l := apitest.Pool(t, me); len(l) != 1 {
		t.Fatalf("pool = %v, want the chore's Task", l)
	}
	for name, set := range map[string]string{
		"done without closed_on": `status = 'done', closed_on = NULL`,
		"open with closed_on":    `status = 'open', closed_on = '2026-03-04'`,
	} {
		if _, err := app.DB.Exec(context.Background(),
			`UPDATE tasks SET `+set+` WHERE chore_id = $1`, id); err == nil {
			t.Errorf("%s: update accepted, want the CHECK to reject it", name)
		}
	}
}

func TestParallelRefreshesLeaveOneOpenTaskPerChore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	var ids []string
	for _, n := range []string{"A", "B", "C"} {
		ids = append(ids, apitest.CreateChore(t, me, apitest.Recurring(n, 2, 1, true)))
	}
	apitest.AtDay(app, 6)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if r := me.Get("/home/tasks"); r.Status != http.StatusOK {
				t.Errorf("GET = %d %s", r.Status, r.Raw)
			}
		}()
	}
	wg.Wait()
	for _, id := range ids {
		if n := countOpen(t, app, id); n != 1 {
			t.Errorf("chore %s has %d open Tasks, want 1", id, n)
		}
	}
}

func TestWindowsKeepWholeDaysAcrossDaylightSavingInTheHomesZone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("America/New_York", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	// Saturday 7 March 22:00 local, before the clocks go forward on the 8th.
	app.Clock.Set(time.Date(2026, time.March, 8, 3, 0, 0, 0, time.UTC))
	apitest.CreateChore(t, me, apitest.Recurring("Dust", 2, 1, true))
	l := apitest.Pool(t, me)
	if len(l) != 1 || l[0]["windowStart"] != "2026-03-07" || l[0]["windowEnd"] != "2026-03-08" {
		t.Fatalf("pool = %v, want window 7 to 8 March", l)
	}
	// Monday 9 March 00:30 local (EDT, 04:30 UTC) is the second missed window's day:
	// day 2 after the start, so one window missed.
	app.Clock.Set(time.Date(2026, time.March, 9, 4, 30, 0, 0, time.UTC))
	if cur, _ := effortOf(t, me); cur != 2 {
		t.Fatalf("current effort = %v, want 2 (one window missed)", cur)
	}
}
