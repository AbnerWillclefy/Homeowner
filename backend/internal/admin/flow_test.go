package admin_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// flowAt asks GET /admin/flow?range=rng as the super admin and decodes it.
func flowAt(t *testing.T, c *apitest.Client, rng string) admin.FlowResponse {
	t.Helper()
	res := c.Get("/admin/flow?range=" + rng)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/flow?range=%s = %d %s", rng, res.Status, res.Raw)
	}
	var out admin.FlowResponse
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// counts maps each step id to its count, failing on a repeated id.
func counts(t *testing.T, f admin.FlowResponse) map[string]int {
	t.Helper()
	out := map[string]int{}
	for _, s := range f.Steps {
		if _, dup := out[s.ID]; dup {
			t.Fatalf("step %q appears twice", s.ID)
		}
		out[s.ID] = s.Count
	}
	return out
}

var flowOrder = []string{"homesDue", "runs", "llmAsked", "llmSkipped", "llmAccepted", "llmFallback", "rejectedRuns",
	"explanationsLlm", "explanationsTemplate", "pushesDelivered", "pushesFailed", "pushesGone", "pushesUnknown"}

// flowWeek runs the Allocation job on three days of March 2026 through the
// real job, with the LLM, the explainer and the push service faked.
//
//	2 Mar: Home A (Residents a and b; a's device accepts, b's fails). The LLM
//	       plans and the explainer writes both explanations.
//	3 Mar: the referee refuses the LLM's plan, the baseline plans, the explainer
//	       fails, so both explanations are the template.
//	4 Mar: Home B (no Energy) is created. Home A's LLM call times out; the
//	       fallback allocator breaks a rule, so both Homes' runs are rejected by
//	       the checker. Two more allocator events were skipped by the cap and
//	       the budget.
//
// Plus one check-in reminder delivered on 4 March, which the flow ignores and
// the overview counts. The clock ends at 09:00 UTC on 4 March.
func flowWeek(t *testing.T) (*apitest.App, string) {
	t.Helper()
	app := apitest.Start(t, apitest.WithPush("k"))
	app.Clock.Set(apitest.MondayAt(6))
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetBaseline(t, c, map[string]any{"monday": 4, "tuesday": 4, "wednesday": 4})
	}
	for _, n := range []string{"One", "Two", "Three"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 1, 2, "normal", []string{}))
	}
	subscribe(t, a, "a")
	app.Push.AnswerError(subscribe(t, b, "b"))
	ra, rb := residentOf(t, app, "a@example.com"), residentOf(t, app, "b@example.com")
	expl := llmalloc.NewFakeClient()
	app.UseLLM(proposer(goodPlan), 3, time.Second)
	app.UseExplainer(llmalloc.NewExplainer(expl), 0)

	app.Clock.Set(apitest.MondayAt(7))
	expl.Answer(explainerAnswer(explainerItem(ra, "Alpha"), explainerItem(rb, "Bravo")))
	app.RunAllocation(t)

	apitest.AtDay(app, 3)
	app.UseLLM(proposer(everythingToOne), 3, time.Second)
	expl.Fail(errors.New("503 overloaded"))
	app.RunAllocation(t)

	apitest.AtDay(app, 4)
	soloHome(t, app, "d@example.com", 0)
	app.UseAllocator(overEnergy{})
	app.UseLLM(proposer(timesOut), 3, time.Second)
	app.RunAllocation(t)
	for _, outcome := range []string{"skipped_cap", "skipped_budget"} {
		if _, err := app.DB.Exec(context.Background(), `
			INSERT INTO llm_call_events (created_at, local_date, service, model, outcome)
			VALUES ($1, '2026-03-04', 'allocator', 'claude-haiku-5-5', $2)`, app.Clock.Now(), outcome); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO nudges (resident_id, kind, local_date, sent_at, outcome)
		VALUES ($1, 'checkin_reminder', '2026-03-04', $2, 'delivered')`, ra, app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	return app, ra
}

func TestFlowCountsEveryStepOfThePipelineEndToEnd(t *testing.T) {
	t.Parallel()
	app, _ := flowWeek(t)

	got := flowAt(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	if got.Range != "7d" || got.From != "2026-02-26" || got.To != "2026-03-04" {
		t.Fatalf("range/from/to = %s %s %s", got.Range, got.From, got.To)
	}
	var ids []string
	for _, s := range got.Steps {
		ids = append(ids, s.ID)
	}
	if !reflect.DeepEqual(ids, flowOrder) {
		t.Fatalf("steps = %v, want %v", ids, flowOrder)
	}
	// Home A was due on three days and Home B on one. Four runs: two planned,
	// two rejected. Three calls were made (accepted, refused by the referee, one
	// timeout; Home B has no Energy, so it is never asked) and two were skipped. Two planned runs of two Residents are four
	// explanations, two by the LLM. The plan-ready push of each planned day:
	// a's accepted, b's failed.
	want := map[string]int{
		"homesDue": 4, "runs": 4, "llmAsked": 3, "llmSkipped": 2, "llmAccepted": 1, "llmFallback": 2,
		"rejectedRuns": 2, "explanationsLlm": 2, "explanationsTemplate": 2,
		"pushesDelivered": 2, "pushesFailed": 2, "pushesGone": 0, "pushesUnknown": 0,
	}
	if c := counts(t, got); !reflect.DeepEqual(c, want) {
		t.Errorf("counts = %v\nwant %v", c, want)
	}
	of := map[string]string{}
	for _, s := range got.Steps {
		of[s.ID] = s.Of
	}
	if of["runs"] != "homesDue" || of["llmAccepted"] != "llmAsked" || of["llmFallback"] != "llmAsked" ||
		of["rejectedRuns"] != "runs" || of["homesDue"] != "" {
		t.Errorf("of = %v", of)
	}
}

func TestFlowAgreesWithOverviewAndAIForTheSameRange(t *testing.T) {
	t.Parallel()
	app, _ := flowWeek(t)
	su := app.SignInAsSuperAdmin("admin@example.com")

	for _, rng := range []string{"7d", "30d"} {
		flow := counts(t, flowAt(t, su, rng))
		ov := overview(t, su, rng)
		ai := aiAt(t, su, rng)

		var runs, rejected int
		var pushes admin.Pushes
		for _, d := range ov.Days {
			runs += d.Runs
			rejected += d.Rejected
			pushes.Delivered += d.Pushes.Delivered
			pushes.Failed += d.Pushes.Failed
			pushes.Gone += d.Pushes.Gone
			pushes.Unknown += d.Pushes.Unknown
		}
		var calls, skips int
		for _, d := range ai.Days {
			o := d.Services.Allocator.Outcomes
			skips += o.SkippedCap + o.SkippedBudget
			calls += o.Accepted + o.RejectedByReferee + o.InvalidResponse + o.Timeout + o.Error
		}
		if flow["runs"] != runs || flow["rejectedRuns"] != rejected {
			t.Errorf("%s runs/rejected = %d/%d, overview %d/%d", rng, flow["runs"], flow["rejectedRuns"], runs, rejected)
		}
		if flow["llmAsked"] != calls || flow["llmSkipped"] != skips {
			t.Errorf("%s asked/skipped = %d/%d, ai %d/%d", rng, flow["llmAsked"], flow["llmSkipped"], calls, skips)
		}
		if flow["explanationsLlm"] != ai.ExplanationShare.LLM || flow["explanationsTemplate"] != ai.ExplanationShare.Template {
			t.Errorf("%s explanations = %d/%d, ai %+v", rng, flow["explanationsLlm"], flow["explanationsTemplate"], ai.ExplanationShare)
		}
		// The overview counts both nudge kinds; the seeded check-in reminder
		// was delivered, so it is the only difference.
		if flow["pushesDelivered"]+1 != pushes.Delivered || flow["pushesFailed"] != pushes.Failed ||
			flow["pushesGone"] != pushes.Gone || flow["pushesUnknown"] != pushes.Unknown {
			t.Errorf("%s pushes = %v, overview %+v (one reminder more delivered)", rng, flow, pushes)
		}
	}
}

func TestFlowOfAnEmptyRangeHasEveryStepAtZero(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	got := flowAt(t, app.SignInAsSuperAdmin("admin@example.com"), "30d")

	if len(got.Steps) != len(flowOrder) {
		t.Fatalf("steps = %d, want %d", len(got.Steps), len(flowOrder))
	}
	for i, s := range got.Steps {
		if s.ID != flowOrder[i] || s.Count != 0 {
			t.Errorf("step %d = %+v, want %s at 0", i, s, flowOrder[i])
		}
	}
}

func TestFlowRejectsAnyOtherRange(t *testing.T) {
	t.Parallel()
	su := apitest.Start(t).SignInAsSuperAdmin("admin@example.com")
	for _, path := range []string{"/admin/flow", "/admin/flow?range=", "/admin/flow?range=90d"} {
		if res := su.Get(path); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid range" {
			t.Errorf("GET %s = %d %s, want 400 invalid range", path, res.Status, res.Raw)
		}
	}
}

func TestFlowLeaksNoPersonalDataAndHasAKnownKeySet(t *testing.T) {
	t.Parallel()
	app, _ := flowWeek(t)
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/flow?range=30d")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/flow = %d %s", res.Status, res.Raw)
	}
	var decoded any
	if err := json.Unmarshal(res.Raw, &decoded); err != nil {
		t.Fatal(err)
	}
	secrets := []string{"a@example.com", "b@example.com", "d@example.com", "One", "Two", "Three", "Alpha", "Bravo"}
	forbidden := map[string]bool{"email": true, "name": true, "displayName": true, "userId": true, "user_id": true,
		"title": true, "choreName": true, "homeId": true, "residentId": true, "runId": true}
	walk(decoded, func(k string) {
		if forbidden[k] {
			t.Errorf("response has the key %q: %s", k, res.Raw)
		}
	}, func(s string) {
		for _, secret := range secrets {
			if strings.EqualFold(s, secret) || strings.Contains(s, "@") {
				t.Errorf("response has the value %q", s)
			}
		}
	})

	keys := map[string]bool{}
	walk(decoded, func(k string) { keys[k] = true }, func(string) {})
	for _, k := range []string{"range", "from", "to", "steps", "id", "count", "of"} {
		if !keys[k] {
			t.Errorf("response lacks the key %q", k)
		}
		delete(keys, k)
	}
	if len(keys) != 0 {
		t.Errorf("response has unexpected keys %v", keys)
	}
}
