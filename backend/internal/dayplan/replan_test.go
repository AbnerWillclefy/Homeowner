package dayplan_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// eventsServer serves the Allocation function's handler over app's planner,
// with replan switched on or off, and returns a sender of event bodies.
func eventsServer(t *testing.T, app *apitest.App, replan bool) func(body string) (int, string) {
	t.Helper()
	var opts []dayplan.EventsOption
	if replan {
		opts = append(opts, dayplan.WithReplan())
	}
	srv := httptest.NewServer(dayplan.EventsHandler(app.Planner, app.Clock, slog.New(slog.NewJSONHandler(app.Logs, nil)), opts...))
	t.Cleanup(srv.Close)
	return func(body string) (int, string) {
		res, err := http.Post(srv.URL+"/events", "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, err := io.ReadAll(res.Body)
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode, string(b)
	}
}

func replanBody(t *testing.T, homeID string) string {
	t.Helper()
	b, err := json.Marshal(dayplan.NewReplanEvent(homeID))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

const scheduledBody = `{"version":"0","source":"aws.events","detail-type":"Scheduled Event","detail":{}}`

// queryStrings runs a query that returns one text column and collects it.
func queryStrings(t *testing.T, app *apitest.App, sql string, args ...any) []string {
	t.Helper()
	rows, err := app.DB.Query(context.Background(), sql, args...)
	if err != nil {
		t.Fatal(err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// runIDs lists the ids of the Home's runs.
func runIDs(t *testing.T, app *apitest.App, homeID string) []string {
	t.Helper()
	return queryStrings(t, app, `SELECT id FROM allocation_runs WHERE home_id = $1 ORDER BY id`, homeID)
}

// homePairs lists "task:resident" for every assignment of the Home's runs.
func homePairs(t *testing.T, app *apitest.App, homeID string) []string {
	t.Helper()
	out := queryStrings(t, app, `
		SELECT a.task_id || ':' || a.resident_id
		FROM day_plan_assignments a JOIN allocation_runs r ON r.id = a.run_id
		WHERE r.home_id = $1`, homeID)
	slices.Sort(out)
	return out
}

// explanationRunIDs lists the runs the Home's explanations belong to.
func explanationRunIDs(t *testing.T, app *apitest.App, homeID string) []string {
	t.Helper()
	return queryStrings(t, app, `
		SELECT DISTINCT e.run_id FROM day_plan_explanations e JOIN allocation_runs r ON r.id = e.run_id WHERE r.home_id = $1`, homeID)
}

// monday is A and B at 07:00 on Monday with five Effort-2 Chores and Energy 4
// each: four Tasks are assigned and one is left in the pool.
func monday(t *testing.T, opts ...apitest.Option) (app *apitest.App, a, b *apitest.Client) {
	t.Helper()
	app = apitest.Start(t, opts...)
	a = apitest.HomeWithResident(t, app, "a@example.com")
	b = apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	return app, a, b
}

func TestAReplanEventIsRefusedWhenReplanIsOff(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	app.RunAllocation(t)
	home := homeIDOf(t, a)
	before := runIDs(t, app, home)
	send := eventsServer(t, app, false)

	if status, _ := send(replanBody(t, home)); status != http.StatusBadRequest {
		t.Fatalf("replan event with the flag off = %d, want 400", status)
	}
	if after := runIDs(t, app, home); !slices.Equal(before, after) {
		t.Fatalf("runs = %v, want %v untouched", after, before)
	}
}

func TestAReplanEventRefusedWithReplanOffCallsNoLLM(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	send := eventsServer(t, app, false)
	if status, _ := send(replanBody(t, homeIDOf(t, a))); status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
	if fake.Calls() != 0 || runs(t, app) != 0 {
		t.Fatalf("llm calls = %d, runs = %d, want nothing done", fake.Calls(), runs(t, app))
	}
}

func TestTheScheduledEventBehavesTheSameWithReplanOnOrOff(t *testing.T) {
	t.Parallel()
	for name, on := range map[string]bool{"off": false, "on": true} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, _, _ := monday(t)
			send := eventsServer(t, app, on)
			status, body := send(scheduledBody)
			if status != http.StatusOK {
				t.Fatalf("scheduled event = %d, want 200", status)
			}
			var sum dayplan.Summary
			if err := json.Unmarshal([]byte(body), &sum); err != nil || sum.Planned != 1 {
				t.Fatalf("body %q, summary %+v, err %v: want one Home planned", body, sum, err)
			}
			if got := runs(t, app); got != 1 {
				t.Fatalf("%d runs, want 1", got)
			}
		})
	}
}

func TestAReplanEventReplacesTodaysRunWhenReplanIsOn(t *testing.T) {
	t.Parallel()
	app, a, b := monday(t)
	app.RunAllocation(t)
	home := homeIDOf(t, a)
	oldRun, oldPairs := runIDs(t, app, home), homePairs(t, app, home)
	if len(oldRun) != 1 || len(oldPairs) != 4 {
		t.Fatalf("setup: runs %v, pairs %v", oldRun, oldPairs)
	}
	// Something changed since the first plan: B has no Energy left on Monday.
	apitest.SetBaseline(t, b, map[string]any{"monday": 0})
	send := eventsServer(t, app, true)

	if status, body := send(replanBody(t, home)); status != http.StatusOK {
		t.Fatalf("replan event = %d %s, want 200", status, body)
	}
	newRun := runIDs(t, app, home)
	if len(newRun) != 1 || newRun[0] == oldRun[0] {
		t.Fatalf("runs = %v, want one new run replacing %v", newRun, oldRun)
	}
	newPairs := homePairs(t, app, home)
	if slices.Equal(newPairs, oldPairs) || len(newPairs) != 2 {
		t.Fatalf("assignments = %v, want the new plan for A alone (was %v)", newPairs, oldPairs)
	}
}

func TestReplanLeavesOtherHomesAlone(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	c := apitest.HomeWithResident(t, app, "c@example.com")
	apitest.SetBaseline(t, c, map[string]any{"monday": 4})
	apitest.CreateChore(t, c, apitest.Chore("Other", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	if sum := app.RunAllocation(t); sum.Planned != 2 {
		t.Fatalf("summary = %+v", sum)
	}
	mine, other := homeIDOf(t, a), homeIDOf(t, c)
	otherRun, otherPairs, otherExplained := runIDs(t, app, other), homePairs(t, app, other), explanationRunIDs(t, app, other)
	myRun := runIDs(t, app, mine)

	if _, err := app.Planner.ReplanHome(context.Background(), mine, app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	if got := runIDs(t, app, other); !slices.Equal(got, otherRun) {
		t.Errorf("other Home's runs = %v, want %v", got, otherRun)
	}
	if got := homePairs(t, app, other); !slices.Equal(got, otherPairs) {
		t.Errorf("other Home's assignments = %v, want %v", got, otherPairs)
	}
	if got := explanationRunIDs(t, app, other); !slices.Equal(got, otherExplained) {
		t.Errorf("other Home's explanations = %v, want %v", got, otherExplained)
	}
	if got := runIDs(t, app, mine); len(got) != 1 || got[0] == myRun[0] {
		t.Errorf("replanned Home's runs = %v, want one new run (was %v)", got, myRun)
	}
}

func TestReplanKeepsTheDailyCapAndStoresTheFallbackReason(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	app.UseLLM(llmalloc.New(fake), 1, time.Second)
	app.RunAllocation(t) // spends the one call
	if r := theRun(t, app); r.allocator != "llm" {
		t.Fatalf("setup: run = %+v", r)
	}
	send := eventsServer(t, app, true)

	if status, body := send(replanBody(t, homeIDOf(t, a))); status != http.StatusOK {
		t.Fatalf("replan event = %d %s", status, body)
	}
	r := theRun(t, app)
	if r.allocator != "baseline" || r.fallback == nil || *r.fallback != "llm_daily_cap_reached" {
		t.Fatalf("run = %+v, want the baseline with llm_daily_cap_reached", r)
	}
	if got := llmCalls(t, app); got != 1 {
		t.Fatalf("llm_calls = %d, want 1: a replan does not reset the counter", got)
	}
	if fake.Calls() != 1 {
		t.Fatalf("the model was called %d times, want 1", fake.Calls())
	}
}

func TestReplanSpendsOneMoreLLMCallWhenTheCapIsNotReached(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	app.RunAllocation(t)
	if _, err := app.Planner.ReplanHome(context.Background(), homeIDOf(t, a), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	if got := llmCalls(t, app); got != 2 {
		t.Fatalf("llm_calls = %d, want 2", got)
	}
	if fake.Calls() != 2 {
		t.Fatalf("model calls = %d, want 2", fake.Calls())
	}
}

func TestReplanSendsDayPlanReadyAgainAndNothingElse(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a, _ := pair(t, app) // Sao Paulo, 07:00
	// Another Home, an hour from its Allocation time, with a device: a tick
	// would remind it to check in.
	c := newHome(t, app, "c@example.com", "UTC", "11:00")
	subscribe(t, c, "c")
	app.Clock.Set(utc(4, 10, 0))
	home := homeIDOf(t, a)

	// A replan before any tick just plans, and reminds nobody.
	if _, err := app.Planner.ReplanHome(context.Background(), home, app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	wantPushes(t, app, ready+":a", ready+":b")

	// The tick plans nothing more for that Home, but does remind C.
	app.RunAllocation(t)
	wantPushes(t, app, ready+":a", ready+":b", reminder+":c")

	// A second replan sends the nudge again to the Home's Residents only.
	if _, err := app.Planner.ReplanHome(context.Background(), home, app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	wantPushes(t, app, ready+":a", ready+":a", ready+":b", ready+":b", reminder+":c")
}

func TestReplanWritesNewExplanations(t *testing.T) {
	t.Parallel()
	h := newExHome(t)
	h.app.UseLLM(llmalloc.New(h.alloc), 10, time.Second)
	h.expl.Answer(say(item(h.ra, "Hi A."), item(h.rb, "Hi B.")))
	h.app.RunAllocation(t)
	if _, en, _, _ := explanationOf(t, h.a); en != "Hi A." {
		t.Fatalf("setup: explanation = %q", en)
	}
	home := homeIDOf(t, h.a)
	oldRun := runIDs(t, h.app, home)

	h.expl.Answer(say(item(h.ra, "Fresh A."), item(h.rb, "Fresh B.")))
	if _, err := h.app.Planner.ReplanHome(context.Background(), home, h.app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	newRun := runIDs(t, h.app, home)
	if newRun[0] == oldRun[0] {
		t.Fatalf("runs = %v, want a new run", newRun)
	}
	source, en, _, ok := explanationOf(t, h.a)
	if !ok || source != "llm" || en != "Fresh A." {
		t.Fatalf("explanation = %q %q, want the new llm text", source, en)
	}
	if got := explanationRunIDs(t, h.app, home); !slices.Equal(got, newRun) {
		t.Fatalf("explanations belong to %v, want %v", got, newRun)
	}
}

func TestReplanOfAHomeWithoutARunJustPlans(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	out, err := app.Planner.ReplanHome(context.Background(), homeIDOf(t, a), app.Clock.Now())
	if err != nil || out != dayplan.Planned {
		t.Fatalf("outcome %q, err %v, want planned", out, err)
	}
	if runs(t, app) != 1 {
		t.Fatalf("%d runs, want 1", runs(t, app))
	}
}

type brokenAllocator struct{}

func (brokenAllocator) Name() string { return "broken" }
func (brokenAllocator) Plan(allocation.State) (allocation.Result, error) {
	return allocation.Result{}, errors.New("boom")
}

func TestReplanReplacesARejectedRun(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	app.UseAllocator(brokenAllocator{})
	app.RunAllocation(t)
	if r := theRun(t, app); r.outcome != "rejected" {
		t.Fatalf("setup: run = %+v", r)
	}
	app.UseAllocator(allocation.Baseline{})
	out, err := app.Planner.ReplanHome(context.Background(), homeIDOf(t, a), app.Clock.Now())
	if err != nil || out != dayplan.Planned {
		t.Fatalf("outcome %q, err %v, want planned", out, err)
	}
	if r := theRun(t, app); r.outcome != "planned" {
		t.Fatalf("run = %+v, want planned", r)
	}
}

func TestReplanOfAnUnknownOrBadHomeFailsCleanly(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	app.RunAllocation(t)
	home := homeIDOf(t, a)
	send := eventsServer(t, app, true)

	if status, _ := send(replanBody(t, "not-a-uuid")); status != http.StatusBadRequest {
		t.Errorf("malformed id = %d, want 400", status)
	}
	if status, _ := send(`{"source":"homeowner.dev","detail-type":"Replan Home","detail":{}}`); status != http.StatusBadRequest {
		t.Errorf("missing id = %d, want 400", status)
	}
	if status, _ := send(replanBody(t, "00000000-0000-0000-0000-000000000000")); status != http.StatusNotFound {
		t.Errorf("unknown Home = %d, want 404", status)
	}
	if _, err := app.DB.Exec(context.Background(), `UPDATE homes SET timezone = 'Nowhere/Land' WHERE id = $1`, home); err != nil {
		t.Fatal(err)
	}
	before := runIDs(t, app, home)
	if status, _ := send(replanBody(t, home)); status != http.StatusInternalServerError {
		t.Errorf("unknown timezone = %d, want 500", status)
	}
	if got := runIDs(t, app, home); !slices.Equal(got, before) {
		t.Errorf("runs = %v, want %v kept when the replan failed", got, before)
	}
}

func TestReplanRacingTheTickAndItselfLeavesOneRun(t *testing.T) {
	t.Parallel()
	app, a, _ := monday(t)
	home := homeIDOf(t, a)
	app.RunAllocation(t)

	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if i%3 == 0 {
				if _, err := app.Planner.RunDue(context.Background(), app.Clock.Now()); err != nil {
					t.Error(err)
				}
				return
			}
			if _, err := app.Planner.ReplanHome(context.Background(), home, app.Clock.Now()); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := runIDs(t, app, home); len(got) != 1 {
		t.Fatalf("runs = %v, want exactly one", got)
	}
	if got := len(homePairs(t, app, home)); got != 4 {
		t.Fatalf("%d assignments, want 4", got)
	}
}
