package dayplan_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func wantConflict(t *testing.T, r apitest.Response, code string) {
	t.Helper()
	if r.Status != http.StatusConflict || r.Body["error"] != code {
		t.Fatalf("got %d %s, want 409 %s", r.Status, r.Raw, code)
	}
}

func committedOf(tasks []map[string]any, name string) any {
	for _, tk := range tasks {
		if tk["choreName"] == name {
			return tk["committed"]
		}
	}
	return "missing"
}

func TestAcceptCommitsTheTaskAndTwiceChangesNothing(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	id := mine[0]["id"].(string)
	if mine[0]["committed"] != false {
		t.Fatalf("a proposed Task starts uncommitted: %v", mine[0])
	}

	r := apitest.MustAct(t, a, "accept", id)
	if r.Body["allocationTime"] != "07:00" || committedOf(apitest.TaskList(t, r.Body["mine"]), mine[0]["choreName"].(string)) != true {
		t.Fatalf("not the Day Plan with the Task committed: %s", r.Raw)
	}
	again := apitest.MustAct(t, a, "accept", id)
	if string(again.Raw) != string(r.Raw) {
		t.Fatalf("a second accept changed the plan:\n%s\n%s", r.Raw, again.Raw)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, id); got != 1 {
		t.Fatalf("%d commitments, want 1", got)
	}
	if string(apitest.DayPlan(t, a).Raw) != string(r.Raw) {
		t.Fatal("GET differs from the answer")
	}
	// The other Resident sees it committed in `others`.
	others := apitest.DayPlan(t, b).Body["others"].([]any)[0].(map[string]any)
	if committedOf(apitest.TaskList(t, others["tasks"]), mine[0]["choreName"].(string)) != true {
		t.Fatalf("others do not show it committed: %v", others)
	}
}

func TestAcceptRefusesWhatIsNotTheCallersProposedTask(t *testing.T) {
	t.Parallel()
	_, a, b := apitest.TwoResidents(t)
	theirs := apitest.IDOf(t, apitest.MineOf(t, b), apitest.MineOf(t, b)[0]["choreName"].(string))
	wantConflict(t, apitest.Act(a, "accept", theirs), "not_proposed")
	poolID := apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"])[0]["id"].(string)
	wantConflict(t, apitest.Act(a, "accept", poolID), "not_proposed")
}

func TestAcceptNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	t.Run("no run", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := apitest.HomeWithResident(t, app, "a@example.com")
		app.Clock.Set(apitest.MondayAt(6))
		apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
		id := apitest.Pool(t, me)[0]["id"].(string)
		wantConflict(t, apitest.Act(me, "accept", id), "no_plan_today")
	})
	t.Run("rejected run", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		me := apitest.HomeWithResident(t, app, "a@example.com") // no Baseline: the stub overspends
		app.Clock.Set(apitest.MondayAt(6))
		apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
		app.UseAllocator(overEnergy{})
		app.Clock.Set(apitest.MondayAt(7))
		app.RunAllocation(t)
		id := apitest.Pool(t, me)[0]["id"].(string)
		wantConflict(t, apitest.Act(me, "accept", id), "no_plan_today")
	})
}

func TestAcceptAllCommitsOnlyTheCallersProposedTasks(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	r := a.Post("/home/day-plan/accept-all", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("accept-all = %d %s", r.Status, r.Raw)
	}
	for _, tk := range apitest.TaskList(t, r.Body["mine"]) {
		if tk["committed"] != true {
			t.Fatalf("not all committed: %s", r.Raw)
		}
	}
	for _, tk := range apitest.MineOf(t, b) {
		if tk["committed"] != false {
			t.Fatalf("B's Task was committed by A: %s", apitest.DayPlan(t, b).Raw)
		}
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents`); got != 2 {
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
	me := apitest.HomeWithResident(t, app, "a@example.com")
	wantConflict(t, me.Post("/home/day-plan/accept-all", nil), "no_plan_today")
}

func TestTaskActionsAnswer404ForAnIdThatIsNotTheCallersHomes(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	other := apitest.HomeWithResident(t, app, "other@example.com")
	apitest.SetBaseline(t, other, map[string]any{"monday": 4})
	apitest.CreateChore(t, other, apitest.Chore("Foreign", 7, 2, "normal", []string{}))
	foreign := apitest.Pool(t, other)[0]["id"].(string)
	for _, action := range []string{"accept", "refuse", "take", "complete"} {
		for _, id := range []string{"abc", "00000000-0000-0000-0000-000000000000", foreign} {
			if r := apitest.Act(a, action, id); r.Status != http.StatusNotFound || r.Body["error"] != "task not found" {
				t.Fatalf("%s %s = %d %s, want 404 task not found", action, id, r.Status, r.Raw)
			}
		}
	}
}
