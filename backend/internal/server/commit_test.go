package server_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// act posts one of the Day Plan actions on a Task: accept, refuse, take or
// complete.
func act(c *apitest.Client, action, taskID string) apitest.Response {
	return c.Post("/home/tasks/"+taskID+"/"+action, nil)
}

func mustAct(t *testing.T, c *apitest.Client, action, taskID string) apitest.Response {
	t.Helper()
	r := act(c, action, taskID)
	if r.Status != http.StatusOK {
		t.Fatalf("POST %s %s = %d %s", action, taskID, r.Status, r.Raw)
	}
	return r
}

func wantConflict(t *testing.T, r apitest.Response, code string) {
	t.Helper()
	if r.Status != http.StatusConflict || r.Body["error"] != code {
		t.Fatalf("got %d %s, want 409 %s", r.Status, r.Raw, code)
	}
}

func mineOf(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	return taskList(t, dayPlan(t, c).Body["mine"])
}

func idOf(t *testing.T, tasks []map[string]any, name string) string {
	t.Helper()
	for _, tk := range tasks {
		if tk["choreName"] == name {
			return tk["id"].(string)
		}
	}
	t.Fatalf("no Task %q in %v", name, tasks)
	return ""
}

func committedOf(tasks []map[string]any, name string) any {
	for _, tk := range tasks {
		if tk["choreName"] == name {
			return tk["committed"]
		}
	}
	return "missing"
}

// twoResidents is a Home planned at 07:00 on Monday for A and B, each with
// Energy 4 (two Effort-2 Tasks): One and Two go to A, Three and Four to B, and
// Five is left in the pool.
func twoResidents(t *testing.T) (app *apitest.App, a, b *apitest.Client) {
	t.Helper()
	app = apitest.Start(t)
	a = homeWithResident(t, app, "a@example.com")
	b = extraResident(t, app, a, "b@example.com")
	setBaseline(t, a, map[string]any{"monday": 4, "tuesday": 4})
	setBaseline(t, b, map[string]any{"monday": 4, "tuesday": 4})
	app.Clock.Set(mondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		createChore(t, a, chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	if len(mineOf(t, a)) != 2 || len(mineOf(t, b)) != 2 || len(taskList(t, dayPlan(t, a).Body["pool"])) != 1 {
		t.Fatalf("setup: %s", dayPlan(t, a).Raw)
	}
	return app, a, b
}

func TestAcceptCommitsTheTaskAndTwiceChangesNothing(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	mine := mineOf(t, a)
	id := mine[0]["id"].(string)
	if mine[0]["committed"] != false {
		t.Fatalf("a proposed Task starts uncommitted: %v", mine[0])
	}

	r := mustAct(t, a, "accept", id)
	if r.Body["allocationTime"] != "07:00" || committedOf(taskList(t, r.Body["mine"]), mine[0]["choreName"].(string)) != true {
		t.Fatalf("not the Day Plan with the Task committed: %s", r.Raw)
	}
	again := mustAct(t, a, "accept", id)
	if string(again.Raw) != string(r.Raw) {
		t.Fatalf("a second accept changed the plan:\n%s\n%s", r.Raw, again.Raw)
	}
	if got := count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, id); got != 1 {
		t.Fatalf("%d commitments, want 1", got)
	}
	if string(dayPlan(t, a).Raw) != string(r.Raw) {
		t.Fatal("GET differs from the answer")
	}
	// The other Resident sees it committed in `others`.
	others := dayPlan(t, b).Body["others"].([]any)[0].(map[string]any)
	if committedOf(taskList(t, others["tasks"]), mine[0]["choreName"].(string)) != true {
		t.Fatalf("others do not show it committed: %v", others)
	}
}

func TestAcceptRefusesWhatIsNotTheCallersProposedTask(t *testing.T) {
	t.Parallel()
	_, a, b := twoResidents(t)
	theirs := idOf(t, mineOf(t, b), mineOf(t, b)[0]["choreName"].(string))
	wantConflict(t, act(a, "accept", theirs), "not_proposed")
	poolID := taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)
	wantConflict(t, act(a, "accept", poolID), "not_proposed")
}

func TestAcceptNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	t.Run("no run", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := homeWithResident(t, app, "a@example.com")
		app.Clock.Set(mondayAt(6))
		createChore(t, me, chore("Dishes", 7, 2, "normal", []string{}))
		id := pool(t, me)[0]["id"].(string)
		wantConflict(t, act(me, "accept", id), "no_plan_today")
	})
	t.Run("rejected run", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := homeWithResident(t, app, "a@example.com") // no Baseline: the stub overspends
		app.Clock.Set(mondayAt(6))
		createChore(t, me, chore("Dishes", 7, 2, "normal", []string{}))
		app.UseAllocator(overEnergy{})
		app.Clock.Set(mondayAt(7))
		app.RunAllocation(t)
		id := pool(t, me)[0]["id"].(string)
		wantConflict(t, act(me, "accept", id), "no_plan_today")
	})
}

func TestAcceptAllCommitsOnlyTheCallersProposedTasks(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	r := a.Post("/home/day-plan/accept-all", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("accept-all = %d %s", r.Status, r.Raw)
	}
	for _, tk := range taskList(t, r.Body["mine"]) {
		if tk["committed"] != true {
			t.Fatalf("not all committed: %s", r.Raw)
		}
	}
	for _, tk := range mineOf(t, b) {
		if tk["committed"] != false {
			t.Fatalf("B's Task was committed by A: %s", dayPlan(t, b).Raw)
		}
	}
	if got := count(t, app, `SELECT count(*) FROM task_residents`); got != 2 {
		t.Fatalf("%d commitments, want A's 2", got)
	}
	// With nothing left to accept it is still a 200.
	if again := a.Post("/home/day-plan/accept-all", nil); again.Status != http.StatusOK || string(again.Raw) != string(r.Raw) {
		t.Fatalf("second accept-all = %d %s", again.Status, again.Raw)
	}
}

func TestAcceptAllNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	wantConflict(t, me.Post("/home/day-plan/accept-all", nil), "no_plan_today")
}

func TestTaskActionsAnswer404ForAnIdThatIsNotTheCallersHomes(t *testing.T) {
	t.Parallel()
	app, a, _ := twoResidents(t)
	other := homeWithResident(t, app, "other@example.com")
	setBaseline(t, other, map[string]any{"monday": 4})
	createChore(t, other, chore("Foreign", 7, 2, "normal", []string{}))
	foreign := pool(t, other)[0]["id"].(string)
	for _, action := range []string{"accept", "refuse", "take", "complete"} {
		for _, id := range []string{"abc", "00000000-0000-0000-0000-000000000000", foreign} {
			if r := act(a, action, id); r.Status != http.StatusNotFound || r.Body["error"] != "task not found" {
				t.Fatalf("%s %s = %d %s, want 404 task not found", action, id, r.Status, r.Raw)
			}
		}
	}
}
