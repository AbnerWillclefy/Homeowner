package voice_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// planned is TwoResidents with voice on: A holds One and Two (proposed), B holds
// Three and Four, and Five is in the pool. Carry is a two-person Task in the pool.
func planned(t *testing.T) (app *apitest.App, a, b *apitest.Client, ids map[string]string) {
	t.Helper()
	app = apitest.Start(t, apitest.WithVoice())
	a = apitest.HomeWithResident(t, app, "a@example.com")
	b = apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	apitest.CreateChore(t, a, apitest.TwoPersonChore("Carry", 5))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	// The Allocator picks who gets which Chore, so name the Tasks by role.
	idsOf := func(c *apitest.Client, key string) (out []string) {
		for _, tk := range apitest.TaskList(t, apitest.DayPlan(t, c).Body[key]) {
			if key == "pool" && tk["people"] == float64(2) {
				out = append(out, "carry:"+tk["id"].(string))
			} else {
				out = append(out, tk["id"].(string))
			}
		}
		return out
	}
	mine, theirs, pool := idsOf(a, "mine"), idsOf(b, "mine"), idsOf(a, "pool")
	if len(mine) != 2 || len(theirs) != 2 || len(pool) != 2 {
		t.Fatalf("setup: mine %v theirs %v pool %v", mine, theirs, pool)
	}
	ids = map[string]string{"One": mine[0], "Two": mine[1], "Other": theirs[0]}
	for _, p := range pool {
		if id, ok := strings.CutPrefix(p, "carry:"); ok {
			ids["Carry"] = id
		} else {
			ids["Five"] = id
		}
	}
	if ids["Carry"] == "" || ids["Five"] == "" {
		t.Fatalf("setup: pool %v lacks the two-person and the one-person Task", pool)
	}
	return app, a, b, ids
}

func taskTool(name string, ids ...string) call {
	return call{name, map[string]any{"task_ids": ids}}
}

// first returns the one action of an interpret answer.
func first(t *testing.T, r apitest.Response) map[string]any {
	t.Helper()
	as := actions(t, r)
	if len(as) != 1 {
		t.Fatalf("actions = %s, want one", r.Raw)
	}
	return as[0].(map[string]any)
}

func TestTaskToolsByRelationMatrix(t *testing.T) {
	app, a, _, ids := planned(t)
	apitest.MustAct(t, a, "accept", ids["Two"])
	byTask := map[string]string{ // relation -> id
		"proposed":  ids["One"],
		"committed": ids["Two"],
		"pool":      ids["Five"],
		"pool2":     ids["Carry"],
		"other":     ids["Other"],
	}
	// "" means dropped.
	want := map[string]map[string]string{
		"proposed":  {"commit_task": "accept", "refuse_task": "refuse", "complete_task": "complete"},
		"committed": {"commit_task": "", "refuse_task": "", "complete_task": "complete"},
		"pool":      {"commit_task": "take", "refuse_task": "", "complete_task": "complete"},
		"pool2":     {"commit_task": "", "refuse_task": "", "complete_task": ""},
		"other":     {"commit_task": "", "refuse_task": "", "complete_task": ""},
	}
	for rel, tools := range want {
		for tool, verb := range tools {
			t.Run(rel+"/"+tool, func(t *testing.T) {
				say(app, taskTool(tool, byTask[rel]))
				r := interpret(a, "do it")
				if verb == "" {
					if r.Body["status"] != "nothing_understood" || len(actions(t, r)) != 0 {
						t.Fatalf("answer = %s, want the action dropped", r.Raw)
					}
					return
				}
				act := first(t, r)
				req := act["request"].(map[string]any)
				if act["kind"] != verb || act["taskId"] != byTask[rel] || act["choreName"] == "" || act["choreId"] == "" ||
					req["method"] != "POST" || req["path"] != "/home/tasks/"+byTask[rel]+"/"+verb || req["body"] != nil {
					t.Fatalf("action = %v, want %s", act, verb)
				}
			})
		}
	}
}

func TestEveryProposedTaskRequestIsAcceptedByItsEndpoint(t *testing.T) {
	app, a, _, ids := planned(t)
	for _, c := range []struct{ tool, task string }{
		{"commit_task", ids["One"]}, {"refuse_task", ids["Two"]}, {"commit_task", ids["Five"]},
	} {
		say(app, taskTool(c.tool, c.task))
		req := first(t, interpret(a, "go"))["request"].(map[string]any)
		if p := a.Post(req["path"].(string), req["body"]); p.Status != http.StatusOK {
			t.Fatalf("POST %v = %d %s, want 200", req["path"], p.Status, p.Raw)
		}
	}
	say(app, taskTool("complete_task", ids["One"]))
	req := first(t, interpret(a, "done"))["request"].(map[string]any)
	if p := a.Post(req["path"].(string), req["body"]); p.Status != http.StatusOK {
		t.Fatalf("complete = %d %s, want 200", p.Status, p.Raw)
	}
}

func TestTwoMatchingTasksAreCandidatesEachWithItsOwnKind(t *testing.T) {
	app, a, _, ids := planned(t)
	say(app, taskTool("commit_task", ids["One"], ids["Five"], ids["One"]))
	cs := first(t, interpret(a, "I will do it"))["candidates"].([]any)
	if len(cs) != 2 {
		t.Fatalf("candidates = %v, want 2", cs)
	}
	if c := cs[0].(map[string]any); c["kind"] != "accept" || c["taskId"] != ids["One"] {
		t.Fatalf("candidate 0 = %v", c)
	}
	if c := cs[1].(map[string]any); c["kind"] != "take" || c["taskId"] != ids["Five"] {
		t.Fatalf("candidate 1 = %v", c)
	}
}

func TestTaskAndChoreActionsShareTheFiveActionCap(t *testing.T) {
	app, a, _, ids := planned(t)
	say(app, taskTool("commit_task", ids["One"]), taskTool("refuse_task", ids["Two"]), taskTool("commit_task", ids["Five"]))
	if r := interpret(a, "three"); r.Body["status"] != "ok" || len(actions(t, r)) != 3 {
		t.Fatalf("three tasks = %s", r.Raw)
	}
	say(app, taskTool("commit_task", ids["One"]), taskTool("refuse_task", ids["Two"]), taskTool("commit_task", ids["Five"]),
		create(trash()), create(trash()), create(trash()))
	if r := interpret(a, "six"); r.Body["status"] != "too_many" || len(actions(t, r)) != 0 {
		t.Fatalf("six calls = %s", r.Raw)
	}
}

func TestThePromptTasksCarryOnlyFourKeysAndNothingOfOthers(t *testing.T) {
	app, a, b, ids := planned(t)
	say(app)
	interpret(a, "hello")
	user := app.Voice.LastRequest().User
	var msg struct{ Tasks []map[string]any }
	if err := json.Unmarshal([]byte(user), &msg); err != nil {
		t.Fatal(err)
	}
	if len(msg.Tasks) != 6 {
		t.Fatalf("tasks = %v, want 6", msg.Tasks)
	}
	relations := map[string]int{}
	for _, tk := range msg.Tasks {
		if len(tk) != 4 || tk["id"] == nil || tk["chore_id"] == nil || tk["people"] == nil || tk["relation"] == nil {
			t.Errorf("task keys = %v, want id, chore_id, people, relation", tk)
		}
		relations[tk["relation"].(string)]++
	}
	if relations["proposed_to_you"] != 2 || relations["pool"] != 2 || relations["held_by_other"] != 2 {
		t.Fatalf("relations = %v", relations)
	}
	for _, banned := range []string{userID(t, b), strings.ToLower(b.Get("/me").Body["email"].(string)), "energy", "restriction", "preference", "check", "reason"} {
		if strings.Contains(strings.ToLower(user), banned) {
			t.Errorf("the prompt contains %q: %s", banned, user)
		}
	}
	_ = ids
}

func TestATaskOfAnotherHomeIsNotSentAndIsDroppedIfReturned(t *testing.T) {
	app, a, _, ids := planned(t)
	other := apitest.HomeWithResident(t, app, "c@example.com")
	apitest.SetBaseline(t, other, map[string]any{"monday": 4})
	apitest.CreateChore(t, other, apitest.Chore("Secret", 7, 2, "normal", []string{}))
	app.RunAllocation(t)
	theirs := apitest.IDOf(t, apitest.TaskList(t, apitest.DayPlan(t, other).Body["mine"]), "Secret")

	say(app, taskTool("commit_task", theirs))
	r := interpret(a, "x")
	if r.Body["status"] != "nothing_understood" || strings.Contains(app.Voice.LastRequest().User, theirs) {
		t.Fatalf("foreign task = %s", r.Raw)
	}
	say(app, taskTool("commit_task", theirs, ids["One"]))
	if act := first(t, interpret(a, "x")); act["taskId"] != ids["One"] {
		t.Fatalf("mixed ids = %v, want only Home A's Task", act)
	}
}

func TestBeforeTheAllocationTimeNoTasksAreSent(t *testing.T) {
	app := apitest.Start(t, apitest.WithVoice())
	a := apitest.HomeWithResident(t, app, "a@example.com")
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.Chore("One", 7, 2, "normal", []string{}))
	say(app)
	interpret(a, "hello")
	var msg struct{ Tasks []any }
	if err := json.Unmarshal([]byte(app.Voice.LastRequest().User), &msg); err != nil || msg.Tasks == nil || len(msg.Tasks) != 0 {
		t.Fatalf("tasks = %v (%v), want []", msg.Tasks, err)
	}
}
