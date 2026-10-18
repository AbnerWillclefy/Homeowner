package dayplan_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// llmHome is A and B, each with Energy 4 on Monday, five Effort-2 Chores and a
// two-person Chore "Carry", at the 07:00 Allocation time. The job asks fake
// first. st is the State it plans from, for building answers with real ids.
func llmHome(t *testing.T) (app *apitest.App, a *apitest.Client, fake *llmalloc.FakeClient, st allocation.State) {
	t.Helper()
	app = apitest.Start(t)
	a = apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	apitest.SetBaseline(t, b, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	apitest.CreateChore(t, a, apitest.TwoPersonChore("Carry", 1))
	app.Clock.Set(apitest.MondayAt(7))
	if err := tasks.NewStore(app.DB).Refresh(context.Background(), homeIDOf(t, a), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	st = loadStateAt(t, app, homeIDOf(t, a), allocation.DateOf(apitest.MondayAt(7)))
	if len(st.Tasks) != 6 || len(st.Residents) != 2 {
		t.Fatalf("setup: %d tasks, %d residents", len(st.Tasks), len(st.Residents))
	}
	fake = llmalloc.NewFakeClient()
	app.UseLLM(llmalloc.New(fake), 3, time.Second)
	return app, a, fake, st
}

type storedRun struct {
	allocator, outcome string
	fallback           *string
	llmViolations      int
	assignments        []string // "task:resident", sorted
}

func theRun(t *testing.T, app *apitest.App) storedRun {
	t.Helper()
	ctx := context.Background()
	var r storedRun
	err := app.DB.QueryRow(ctx, `
		SELECT allocator, outcome, fallback_reason, coalesce(jsonb_array_length(reasons -> 'llmViolations'), 0)
		FROM allocation_runs`).Scan(&r.allocator, &r.outcome, &r.fallback, &r.llmViolations)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := app.DB.Query(ctx, `SELECT task_id || ':' || resident_id FROM day_plan_assignments`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		r.assignments = append(r.assignments, s)
	}
	slices.Sort(r.assignments)
	return r
}

func pairs(as []allocation.Assignment) []string {
	var out []string
	for _, a := range as {
		out = append(out, a.TaskID+":"+a.ResidentID)
	}
	slices.Sort(out)
	return out
}

func baselinePairs(t *testing.T, st allocation.State) []string {
	t.Helper()
	res, err := allocation.Baseline{}.Plan(st)
	if err != nil {
		t.Fatal(err)
	}
	return pairs(res.DayPlan.Assignments)
}

func answer(as ...allocation.Assignment) string {
	s := `{"pool": [], "assignments": [`
	for i, a := range as {
		if i > 0 {
			s += ","
		}
		s += fmt.Sprintf(`{"task_id": %q, "resident_id": %q, "reason": "importance"}`, a.TaskID, a.ResidentID)
	}
	return s + "]}"
}

func give(task allocation.Task, resident allocation.Resident) allocation.Assignment {
	return allocation.Assignment{TaskID: task.ID, ResidentID: resident.ID}
}

// task returns the State's Task needing people people, the n-th of them.
func task(st allocation.State, people, n int) allocation.Task {
	for _, t := range st.Tasks {
		if t.People == people {
			if n == 0 {
				return t
			}
			n--
		}
	}
	panic("no such task")
}

func TestAValidLLMProposalIsTheDayPlan(t *testing.T) {
	t.Parallel()
	app, a, fake, st := llmHome(t)
	ra, rb := st.Residents[0], st.Residents[1]
	plan := []allocation.Assignment{give(task(st, 1, 0), rb), give(task(st, 2, 0), ra), give(task(st, 2, 0), rb)}
	fake.Answer(answer(plan...))

	if sum := app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	r := theRun(t, app)
	if r.allocator != "llm" || r.outcome != "planned" || r.fallback != nil {
		t.Fatalf("run = %+v", r)
	}
	if want := pairs(plan); !slices.Equal(r.assignments, want) || slices.Equal(want, baselinePairs(t, st)) {
		t.Fatalf("assignments = %v, want the LLM's %v (and not the baseline's)", r.assignments, want)
	}
	if got := apitest.DayPlan(t, a).Body["allocator"]; got != "llm" {
		t.Errorf("GET /home/day-plan allocator = %v", got)
	}
	if fake.Calls() != 1 {
		t.Errorf("calls = %d, want 1", fake.Calls())
	}
}

func TestAProposalTheCheckerRefusesFallsBackToTheBaseline(t *testing.T) {
	t.Parallel()
	for name, bad := range map[string]func(st allocation.State) string{
		"over energy": func(st allocation.State) string {
			r := st.Residents[0]
			return answer(give(task(st, 1, 0), r), give(task(st, 1, 1), r), give(task(st, 1, 2), r))
		},
		"unknown task": func(st allocation.State) string {
			return answer(allocation.Assignment{TaskID: "00000000-0000-0000-0000-000000000000", ResidentID: st.Residents[0].ID})
		},
		"unknown resident": func(st allocation.State) string {
			return answer(allocation.Assignment{TaskID: task(st, 1, 0).ID, ResidentID: "00000000-0000-0000-0000-000000000000"})
		},
		"one task twice": func(st allocation.State) string {
			return answer(give(task(st, 1, 0), st.Residents[0]), give(task(st, 1, 0), st.Residents[1]))
		},
		"two-person task given once": func(st allocation.State) string {
			return answer(give(task(st, 2, 0), st.Residents[0]))
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, _, fake, st := llmHome(t)
			fake.Answer(bad(st))

			if sum := app.RunAllocation(t); sum.Planned != 1 {
				t.Fatalf("summary = %+v", sum)
			}
			r := theRun(t, app)
			if r.allocator != "baseline" || r.outcome != "planned" || r.fallback == nil || *r.fallback != "llm_rejected_by_checker" || r.llmViolations == 0 {
				t.Fatalf("run = %+v", r)
			}
			if want := baselinePairs(t, st); !slices.Equal(r.assignments, want) {
				t.Fatalf("assignments = %v, want the baseline's %v", r.assignments, want)
			}
		})
	}
}

// The model is not trusted to honour the weekday or a Restriction: the Go
// filter keeps such a Task out of its input, but an answer that gives it to a
// Resident anyway is refused by Check and the Home gets the baseline's plan.
func TestAnAnswerBreakingAWeekdayRuleFallsBackToTheBaseline(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, a, map[string]any{"tuesday": 4, "wednesday": 4})
	apitest.AtDay(app, 3) // Tuesday: both Tasks open
	apitest.CreateChore(t, a, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	apitest.CreateChore(t, a, apitest.Chore("Garden", 1, 2, "normal", []string{}, 2)) // Tuesdays only
	if err := tasks.NewStore(app.DB).Refresh(context.Background(), homeIDOf(t, a), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}
	apitest.AtDay(app, 4) // Wednesday: the Garden Task is overdue and forbidden
	st := loadStateAt(t, app, homeIDOf(t, a), allocation.DateOf(app.Clock.Now()))
	var garden allocation.Task
	for _, tk := range st.Tasks {
		if len(tk.AllowedWeekdays) > 0 {
			garden = tk
		}
	}
	if garden.ID == "" || len(st.Tasks) < 2 {
		t.Fatalf("setup: tasks = %+v", st.Tasks)
	}
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer(give(garden, st.Residents[0])))
	app.UseLLM(llmalloc.New(fake), 3, time.Second)

	if sum := app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	r := theRun(t, app)
	if r.allocator != "baseline" || r.fallback == nil || *r.fallback != "llm_rejected_by_checker" || r.llmViolations == 0 {
		t.Fatalf("run = %+v", r)
	}
	if want := baselinePairs(t, st); !slices.Equal(r.assignments, want) {
		t.Fatalf("assignments = %v, want the baseline's %v", r.assignments, want)
	}
	if strings.Contains(fake.LastRequest().User, garden.ID) {
		t.Error("the weekday-blocked Task must not be sent to the model")
	}
}

func TestAnLLMFailureFallsBackWithItsReason(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		set  func(*llmalloc.FakeClient)
		want string
	}{
		"malformed answer": {func(f *llmalloc.FakeClient) { f.Answer(`not json`) }, "llm_invalid_response"},
		"client error":     {func(f *llmalloc.FakeClient) { f.Fail(errors.New("503 overloaded")) }, "llm_error"},
		"timeout":          {func(f *llmalloc.FakeClient) { f.Block() }, "llm_timeout"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, _, fake, st := llmHome(t)
			app.UseLLM(llmalloc.New(fake), 3, 50*time.Millisecond)
			tc.set(fake)

			if sum := app.RunAllocation(t); sum.Planned != 1 {
				t.Fatalf("summary = %+v", sum)
			}
			r := theRun(t, app)
			if r.allocator != "baseline" || r.fallback == nil || *r.fallback != tc.want {
				t.Fatalf("run = %+v, want baseline with %s", r, tc.want)
			}
			if want := baselinePairs(t, st); !slices.Equal(r.assignments, want) {
				t.Fatalf("assignments = %v, want the baseline's %v", r.assignments, want)
			}
		})
	}
}

func TestTheDailyCapStopsTheCallAndFallsBack(t *testing.T) {
	t.Parallel()
	app, a, fake, st := llmHome(t)
	if _, err := app.DB.Exec(context.Background(), `INSERT INTO llm_calls (home_id, call_date, calls) VALUES ($1, $2, 3)`,
		homeIDOf(t, a), st.Today.Time()); err != nil {
		t.Fatal(err)
	}

	if sum := app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	r := theRun(t, app)
	if r.allocator != "baseline" || r.fallback == nil || *r.fallback != "llm_daily_cap_reached" {
		t.Fatalf("run = %+v", r)
	}
	if fake.Calls() != 0 {
		t.Fatalf("calls = %d, want none past the cap", fake.Calls())
	}
}

// The call is counted before it is made and outside the planning transaction,
// so a planning that later rolls back cannot hand back a call that was paid.
func TestTheCallIsCountedBeforeItIsMade(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	counted := -1
	app.UseLLM(peek{llmalloc.New(fake), func() {
		_ = app.DB.QueryRow(context.Background(), `SELECT calls FROM llm_calls WHERE home_id = $1`, homeIDOf(t, a)).Scan(&counted)
	}}, 3, time.Second)

	app.RunAllocation(t)
	if counted != 1 {
		t.Fatalf("another connection saw %d calls during the call, want 1", counted)
	}
}

// The LLM call is slow, so it is made before the planning transaction: it
// holds neither the Home lock (a Check-in for the Home is not kept waiting) nor
// a pooled connection.
func TestTheLLMCallHoldsNoHomeLock(t *testing.T) {
	t.Parallel()
	app, a, fake, _ := llmHome(t)
	var lockErr error
	app.UseLLM(peek{llmalloc.New(fake), func() {
		ctx := context.Background()
		tx, err := app.DB.Begin(ctx)
		if err != nil {
			lockErr = err
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()
		_, lockErr = tx.Exec(ctx, `SELECT 1 FROM homes WHERE id = $1 FOR NO KEY UPDATE NOWAIT`, homeIDOf(t, a))
	}}, 3, time.Second)

	app.RunAllocation(t)
	if lockErr != nil {
		t.Fatalf("the Home was locked during the LLM call: %v", lockErr)
	}
}

type peek struct {
	*llmalloc.Allocator
	during func()
}

func (p peek) Propose(ctx context.Context, st allocation.State) (allocation.Result, error) {
	p.during()
	return p.Allocator.Propose(ctx, st)
}

func TestWithTheLLMOffTheBaselinePlansAndNothingIsAFallback(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 4})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.Chore("One", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))

	app.RunAllocation(t)
	if r := theRun(t, app); r.allocator != "baseline" || r.fallback != nil || len(r.assignments) != 1 {
		t.Fatalf("run = %+v", r)
	}
}

func TestNothingToPlanSpendsNoCall(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	apitest.HomeWithResident(t, app, "a@example.com") // no Chores, no Energy
	fake := llmalloc.NewFakeClient()
	app.UseLLM(llmalloc.New(fake), 3, time.Second)
	app.Clock.Set(apitest.MondayAt(7))

	app.RunAllocation(t)
	if r := theRun(t, app); r.allocator != "baseline" || r.fallback != nil {
		t.Fatalf("run = %+v", r)
	}
	if fake.Calls() != 0 || apitest.Count(t, app, `SELECT count(*) FROM llm_calls`) != 0 {
		t.Fatalf("calls = %d, want none", fake.Calls())
	}
}

// The LLM has one time budget per tick, so slow calls cannot push the tick past
// the Lambda's timeout: once it is spent, the remaining Homes are not asked and
// fall back as a timeout, without spending their cap.
func TestATickStopsAskingTheLLMWhenItsBudgetIsSpent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	for _, email := range []string{"a@example.com", "b@example.com"} {
		c := apitest.HomeWithResident(t, app, email)
		apitest.SetBaseline(t, c, map[string]any{"monday": 4})
		app.Clock.Set(apitest.MondayAt(6))
		apitest.CreateChore(t, c, apitest.Chore("One", 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	fake := llmalloc.NewFakeClient()
	fake.Block()
	p := dayplan.New(app.DB, allocation.Baseline{}, slog.New(slog.NewJSONHandler(app.Logs, nil)),
		dayplan.WithLLM(dayplan.LLMConfig{Proposer: llmalloc.New(fake), DailyCap: 3, CallTimeout: 5 * time.Second, TickBudget: 100 * time.Millisecond}))

	start := time.Now()
	sum, err := p.RunDue(context.Background(), app.Clock.Now())
	if err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(start); sum.Planned != 2 || elapsed > 2*time.Second {
		t.Fatalf("summary = %+v after %s, want both Homes planned well before the 5s call timeout", sum, elapsed)
	}
	if fake.Calls() != 1 || apitest.Count(t, app, `SELECT count(*) FROM llm_calls`) != 1 {
		t.Fatalf("calls = %d, want only the first Home to call", fake.Calls())
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM allocation_runs WHERE allocator = 'baseline' AND fallback_reason = 'llm_timeout'`); n != 2 {
		t.Fatalf("%d runs fell back as llm_timeout, want 2", n)
	}
}
