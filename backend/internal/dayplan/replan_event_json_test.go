package dayplan_test

import (
	"encoding/json"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// .github/workflows/replan-staging.yml builds this same payload with jq and
// invokes the Allocation function. If this literal changes, change the
// workflow's payload too.
func TestReplanEventJSONMatchesTheWorkflowPayload(t *testing.T) {
	const id = "7b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3"
	want := `{"source":"homeowner.dev","detail-type":"Replan Home","detail":{"homeId":"` + id + `"}}`

	got, err := json.Marshal(dayplan.NewReplanEvent(id))

	if err != nil || string(got) != want {
		t.Fatalf("got %s (%v), want %s", got, err, want)
	}
}
