package dayplan_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestTheReadWithoutARunHasNoRunID(t *testing.T) {
	t.Parallel()
	_, a, _ := monday(t) // the job has not run
	if v, ok := apitest.DayPlan(t, a).Body["runId"]; ok {
		t.Errorf("runId = %v, want the key absent", v)
	}
}

// A replan that produces the same plan still changes the runId, so a client
// waiting for it can tell the new run from the old one.
func TestTheReadNamesTodaysRunAndAReplanChangesIt(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	app.RunAllocation(t)
	home := homeIDOf(t, a)
	before := apitest.DayPlan(t, a).Body["runId"]
	if ids := runIDs(t, app, home); len(ids) != 1 || before != ids[0] {
		t.Fatalf("runId = %v, want the stored run %v", before, ids)
	}

	if status, body := eventsServer(t, app, true)(replanBody(t, home)); status != http.StatusOK {
		t.Fatalf("replan event = %d %s, want 200", status, body)
	}
	after := apitest.DayPlan(t, a).Body["runId"]
	if ids := runIDs(t, app, home); after == before || len(ids) != 1 || after != ids[0] {
		t.Errorf("runId = %v after replan (was %v), want the new stored run %v", after, before, ids)
	}
}
