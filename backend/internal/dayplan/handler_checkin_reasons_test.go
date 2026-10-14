package dayplan_test

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAReplanLeavesTheSameReasonsAFullPlanWouldStore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Mop", 7, 2, "normal", []string{}))
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	checkIn(t, me, "low")

	replanned := storedReasons(t, app)
	if n := len(replanned["assigned"].([]any)); n != 1 {
		t.Fatalf("assigned = %d, want 1: %v", n, replanned)
	}
	if n := len(replanned["pool"].([]any)); n != 1 {
		t.Fatalf("pool = %d, want 1: %v", n, replanned)
	}

	// Drop the run and plan the same state in full: the Check-in is already
	// stored, so the job reads it.
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM allocation_runs`); err != nil {
		t.Fatal(err)
	}
	app.RunAllocation(t)
	if full := storedReasons(t, app); !reflect.DeepEqual(replanned, full) {
		t.Fatalf("re-plan stored %v, a full plan stores %v", replanned, full)
	}
}

func storedReasons(t *testing.T, app *apitest.App) map[string]any {
	t.Helper()
	var raw []byte
	if err := app.DB.QueryRow(context.Background(), `SELECT reasons FROM allocation_runs`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}
