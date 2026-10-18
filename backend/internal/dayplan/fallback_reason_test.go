package dayplan_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// reason is the fallbackReason key of a Day Plan read: its value and whether
// the key is there at all.
func reason(body map[string]any) (any, bool) {
	v, ok := body["fallbackReason"]
	return v, ok
}

func TestTheReadNamesTheLLMAllocatorAndNoFallbackReason(t *testing.T) {
	t.Parallel()
	app, a, fake, st := llmHome(t)
	ra, rb := st.Residents[0], st.Residents[1]
	fake.Answer(answer(give(task(st, 1, 0), rb), give(task(st, 2, 0), ra), give(task(st, 2, 0), rb)))
	app.RunAllocation(t)

	body := apitest.DayPlan(t, a).Body
	if body["allocator"] != "llm" {
		t.Errorf("allocator = %v, want llm", body["allocator"])
	}
	if v, ok := reason(body); ok {
		t.Errorf("fallbackReason = %v, want the key absent", v)
	}
}

// llmDailyCap is the daily cap llmHome configures for a Home.
const llmDailyCap = 3

// capReached spends the Home's whole daily LLM cap, then runs the Allocation job.
func capReached(t *testing.T, app *apitest.App, a *apitest.Client, st allocation.State) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `INSERT INTO llm_calls (home_id, call_date, calls) VALUES ($1, $2, $3)`,
		homeIDOf(t, a), st.Today.Time(), llmDailyCap); err != nil {
		t.Fatal(err)
	}
	app.RunAllocation(t)
}

func TestTheReadNamesTheBaselineAndTheDailyCapReason(t *testing.T) {
	t.Parallel()
	app, a, _, st := llmHome(t)
	capReached(t, app, a, st)

	body := apitest.DayPlan(t, a).Body
	if body["allocator"] != "baseline" || body["fallbackReason"] != "llm_daily_cap_reached" {
		t.Errorf("allocator = %v, fallbackReason = %v", body["allocator"], body["fallbackReason"])
	}
}

func TestTheReadReportsAnyFallbackReasonAsStored(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	fake.Fail(errors.New("503 overloaded"))
	app.RunAllocation(t)

	body := apitest.DayPlan(t, a).Body
	if body["allocator"] != "baseline" || body["fallbackReason"] != "llm_error" {
		t.Errorf("allocator = %v, fallbackReason = %v", body["allocator"], body["fallbackReason"])
	}
}

func TestTheReadHasNoFallbackReasonWithTheLLMOff(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.Chore("One", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	body := apitest.DayPlan(t, a).Body
	if v, ok := reason(body); body["allocator"] != "baseline" || ok {
		t.Errorf("allocator = %v, fallbackReason = %v (present %v)", body["allocator"], v, ok)
	}
}

func TestTheReadWithoutARunHasNeitherAllocatorNorFallbackReason(t *testing.T) {
	t.Parallel()
	_, a, _, _ := llmHome(t) // the job has not run
	body := apitest.DayPlan(t, a).Body
	if v, ok := reason(body); body["planned"] != false || body["allocator"] != "" || ok {
		t.Errorf("planned = %v, allocator = %v, fallbackReason = %v (present %v)", body["planned"], body["allocator"], v, ok)
	}
}

// A client written before fallbackReason existed decodes the same body: the
// new key is additive, so every older key keeps its name and type.
func TestAnOlderClientStillReadsTheDayPlan(t *testing.T) {
	t.Parallel()
	app, a, _, st := llmHome(t)
	capReached(t, app, a, st)

	var old struct {
		Date      string            `json:"date"`
		Planned   bool              `json:"planned"`
		Rejected  bool              `json:"rejected"`
		Allocator string            `json:"allocator"`
		Energy    *int              `json:"energy"`
		Mine      []json.RawMessage `json:"mine"`
		Others    []json.RawMessage `json:"others"`
		Pool      []json.RawMessage `json:"pool"`
	}
	if err := json.NewDecoder(bytes.NewReader(apitest.DayPlan(t, a).Raw)).Decode(&old); err != nil {
		t.Fatal(err)
	}
	if !old.Planned || old.Rejected || old.Allocator != "baseline" || old.Energy == nil || old.Date == "" || len(old.Mine)+len(old.Pool) == 0 {
		t.Errorf("old shape = %+v", old)
	}
}
