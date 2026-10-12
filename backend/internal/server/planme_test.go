package server_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func planMe(t *testing.T, c *apitest.Client) apitest.Response {
	t.Helper()
	return c.Post("/home/day-plan/me", nil)
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
