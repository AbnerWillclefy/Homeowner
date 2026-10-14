package dayplan_test

import (
	"context"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func suggested(t *testing.T, c *apitest.Client) bool {
	t.Helper()
	l := apitest.Pool(t, c)
	if len(l) != 1 {
		t.Fatalf("pool = %v", l)
	}
	return l[0]["suggestTwoPerson"] == true
}

func TestReachingTheEffortCapSuggestsMakingTheChoreTwoPerson(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	id := apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 3, 3, true))

	for _, step := range []struct {
		day  int
		want bool
	}{{1, false}, {4, false}, {7, true}, {28, true}} {
		apitest.AtDay(app, step.day)
		if got := suggested(t, me); got != step.want {
			t.Errorf("day %d: suggestTwoPerson = %v, want %v (effort %v)", step.day, got, step.want, apitest.Pool(t, me)[0]["currentEffort"])
		}
	}

	// Done: the next Task restarts at base Effort, below the cap.
	if _, err := app.DB.Exec(context.Background(),
		`UPDATE tasks SET status = 'done', closed_on = '2026-03-28' WHERE chore_id = $1`, id); err != nil {
		t.Fatal(err)
	}
	apitest.AtDay(app, 31)
	if suggested(t, me) {
		t.Errorf("a new Task at base Effort is still suggested: %v", apitest.Pool(t, me))
	}
}

func TestTheSuggestionGoesOnceTheChoreIsTwoPerson(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	id := apitest.CreateChore(t, me, apitest.Recurring("Bathroom", 3, 3, true))
	apitest.AtDay(app, 7)
	if !suggested(t, me) {
		t.Fatalf("setup: %v", apitest.Pool(t, me))
	}
	if _, err := app.DB.Exec(context.Background(), `UPDATE chores SET people = 2 WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if suggested(t, me) {
		t.Errorf("a two-person Chore is still suggested: %v", apitest.Pool(t, me))
	}
}

func TestOnlyBuildUpChoresAtTheCapAreSuggested(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.AtDay(app, 1)
	apitest.CreateChore(t, me, apitest.Recurring("Plain", 3, 5, false))
	apitest.CreateChore(t, me, apitest.Recurring("Grows", 3, 5, true)) // already at the cap at base Effort
	apitest.CreateChore(t, me, apitest.Recurring("Low", 3, 4, true))   // builds up but is not at the cap yet
	byName := map[string]any{}
	for _, tk := range apitest.Pool(t, me) {
		byName[tk["choreName"].(string)] = tk["suggestTwoPerson"]
	}
	if byName["Plain"] == true || byName["Low"] == true || byName["Grows"] != true {
		t.Errorf("suggestions = %v, want only Grows", byName)
	}
}

func TestTheSuggestionAppearsOnTheDayPlanTasksToo(t *testing.T) {
	t.Parallel()
	app, me := planned(t, 5, apitest.Recurring("Bathroom", 3, 5, true), apitest.Recurring("Dust", 3, 5, true))
	allocate(app, t)
	r := dayPlan(t, me)
	mine, pooled := taskList(t, r.Body["mine"]), taskList(t, r.Body["pool"])
	if len(mine) != 1 || len(pooled) != 1 || mine[0]["suggestTwoPerson"] != true || pooled[0]["suggestTwoPerson"] != true {
		t.Fatalf("day plan = %s", r.Raw)
	}
}
