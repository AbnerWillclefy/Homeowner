package dayplan_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestARunAndItsTasksShareTheHomesLocalDateNearMidnight(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("Pacific/Auckland", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	apitest.SetBaseline(t, me, map[string]any{"monday": 10})
	// 10:55 UTC on 2 March is 23:55 in Auckland, still the 2nd; five minutes
	// later it is the 3rd there but still the 2nd in UTC.
	app.Clock.Set(time.Date(2026, time.March, 2, 10, 55, 0, 0, time.UTC))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.RunAllocation(t)

	var planDate, windowStart string
	if err := app.DB.QueryRow(context.Background(), `
		SELECT r.plan_date::text, t.window_start::text
		FROM allocation_runs r, tasks t`).Scan(&planDate, &windowStart); err != nil {
		t.Fatal(err)
	}
	if planDate != "2026-03-02" || windowStart != planDate {
		t.Fatalf("plan_date = %s, task window_start = %s, want both 2026-03-02", planDate, windowStart)
	}
}

func TestRefreshInsideAPlanTransactionLeavesTheStatementTimeoutAsItWas(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))

	var homeID string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM homes`).Scan(&homeID); err != nil {
		t.Fatal(err)
	}
	// "" is the session's setting; "7s" is a caller's own SET LOCAL.
	for _, local := range []string{"", "7s"} {
		before, after, err := dayplan.RefreshStatementTimeout(context.Background(), app.DB, homeID, apitest.MondayAt(8), local)
		if err != nil {
			t.Fatal(err)
		}
		if before != after {
			t.Fatalf("statement_timeout was %s and is %s after the Refresh (caller set %q)", before, after, local)
		}
	}
}

func TestARunStoredWithAnAssignedKeyStillReadsAndLosesTheKeyOnTheNextWrite(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	before := string(apitest.DayPlan(t, a).Raw)

	// A run stored before reasons.assigned was dropped: same rows, extra key.
	if _, err := app.DB.Exec(context.Background(), `
		UPDATE allocation_runs
		SET reasons = reasons || '{"assigned": [{"taskId": "x", "residentId": "y", "reason": "baseline"}]}'::jsonb`); err != nil {
		t.Fatal(err)
	}
	if got := string(apitest.DayPlan(t, a).Raw); got != before {
		t.Fatalf("day plan changed with the old key:\n%s\nwas\n%s", got, before)
	}

	apitest.MustAct(t, a, "refuse", apitest.MineOf(t, a)[0]["id"].(string))
	if got := apitest.Count(t, app, `SELECT count(*) FROM allocation_runs WHERE reasons ? 'assigned'`); got != 0 {
		t.Fatalf("%d runs still carry assigned after a write", got)
	}
}
