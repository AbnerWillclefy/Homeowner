package dayplan_test

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func residentIDOf(t *testing.T, app *apitest.App, email string) string {
	t.Helper()
	var id string
	err := app.DB.QueryRow(context.Background(),
		`SELECT r.id FROM residents r JOIN users u ON u.id = r.user_id WHERE u.email = $1`, email).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func rowsFor(t *testing.T, app *apitest.App) int {
	t.Helper()
	return apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`)
}

func completionResidents(t *testing.T, app *apitest.App) []string {
	t.Helper()
	rows, err := app.DB.Query(context.Background(), `
		SELECT u.email FROM completion_residents cr
		JOIN residents r ON r.id = cr.resident_id JOIN users u ON u.id = r.user_id ORDER BY u.email`)
	if err != nil {
		t.Fatal(err)
	}
	who, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	return who
}

func TestATwoPersonTaskIsInBothResidentsPlans(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	aID, bID := residentIDOf(t, app, "a@example.com"), residentIDOf(t, app, "b@example.com")

	for _, who := range []struct {
		c        *apitest.Client
		me, with string
	}{{a, aID, bID}, {b, bID, aID}} {
		r := apitest.DayPlan(t, who.c)
		mine := apitest.TaskList(t, r.Body["mine"])
		if len(mine) != 1 || mine[0]["choreName"] != "Carry" || mine[0]["reason"] != "importance" || mine[0]["committed"] != false {
			t.Fatalf("mine = %s", r.Raw)
		}
		if w, _ := mine[0]["with"].([]any); len(w) != 1 || w[0] != who.with {
			t.Fatalf("with = %v, want [%s]", mine[0]["with"], who.with)
		}
		groups := r.Body["others"].([]any)
		if len(groups) != 1 || groups[0].(map[string]any)["residentId"] != who.with || len(others(t, r)) != 1 {
			t.Fatalf("others = %s", r.Raw)
		}
		if len(apitest.TaskList(t, r.Body["pool"])) != 0 {
			t.Fatalf("pool = %s", r.Raw)
		}
	}
	if got := rowsFor(t, app); got != 2 {
		t.Fatalf("%d assignment rows, want 2", got)
	}
}

func TestEitherResidentCompletesAndTheCompletionListsBoth(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name     string
		accepted []string // who accepted first: "a", "b"
		by       string
	}{
		{"A completes without anyone accepting", nil, "a"},
		{"B completes without anyone accepting", nil, "b"},
		{"B completes after only A accepted", []string{"a"}, "b"},
		{"A completes after both accepted", []string{"a", "b"}, "a"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, a, b := apitest.DuoHome(t, 2, 3)
			who := map[string]*apitest.Client{"a": a, "b": b}
			id := apitest.MineOf(t, a)[0]["id"].(string)
			for _, x := range tc.accepted {
				apitest.MustAct(t, who[x], "accept", id)
			}
			other := "a"
			if tc.by == "a" {
				other = "b"
			}
			apitest.MustAct(t, who[tc.by], "complete", id)

			if got := completionResidents(t, app); !slices.Equal(got, []string{"a@example.com", "b@example.com"}) {
				t.Fatalf("completion residents = %v, want A and B", got)
			}
			if got := apitest.Count(t, app, `SELECT count(*) FROM completions`); got != 1 {
				t.Fatalf("%d completions, want 1", got)
			}
			aID, bID := residentIDOf(t, app, "a@example.com"), residentIDOf(t, app, "b@example.com")
			for _, c := range []struct {
				c    *apitest.Client
				with string
			}{{a, bID}, {b, aID}} {
				r := apitest.DayPlan(t, c.c)
				done := apitest.TaskList(t, r.Body["doneToday"])
				if len(done) != 1 || done[0]["id"] != id || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
					t.Fatalf("day plan after completing = %s", r.Raw)
				}
				if w, _ := done[0]["with"].([]any); len(w) != 1 || w[0] != c.with {
					t.Fatalf("doneToday with = %v, want only [%s]", done[0]["with"], c.with)
				}
			}
			wantConflict(t, apitest.Act(who[other], "complete", id), "already_done")
			wantConflict(t, apitest.Act(who[tc.by], "complete", id), "already_done")
		})
	}
}

func TestATwoPersonTaskNeedsBothResidentsToHaveEnergy(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 5, 1) // B cannot afford Effort 2
	r := apitest.DayPlan(t, a)
	pooled := apitest.TaskList(t, r.Body["pool"])
	if len(pooled) != 1 || pooled[0]["reason"] != "two_person_deferred" || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("day plan = %s", r.Raw)
	}
	if rowsFor(t, app) != 0 {
		t.Fatal("nobody should be given a half Task")
	}
	id := pooled[0]["id"].(string)
	wantConflict(t, apitest.Act(a, "take", id), "two_person_task")
	wantConflict(t, apitest.Act(b, "take", id), "two_person_task")
}

func TestRefusingATwoPersonTaskFreesBothWhileNobodyCommitted(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	id := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, b, "refuse", id)

	if rowsFor(t, app) != 0 {
		t.Fatal("refusing must remove both assignments")
	}
	for _, c := range []*apitest.Client{a, b} {
		r := apitest.DayPlan(t, c)
		pooled := apitest.TaskList(t, r.Body["pool"])
		if len(pooled) != 1 || pooled[0]["reason"] != "refused" || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
			t.Fatalf("day plan = %s", r.Raw)
		}
	}
}

func TestATwoPersonTaskEitherPartnerCommittedCannotBeRefused(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	id := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", id)

	wantConflict(t, apitest.Act(b, "refuse", id), "already_committed") // the partner promised it
	wantConflict(t, apitest.Act(a, "refuse", id), "already_committed")
	if rowsFor(t, app) != 2 {
		t.Fatal("a refused-but-rejected action changed the rows")
	}
	// Accepting is per Resident: B's accept does not need A's.
	apitest.MustAct(t, b, "accept", id)
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents`); got != 2 {
		t.Fatalf("%d commitments, want one per Resident", got)
	}
}

func TestAcceptAllCommitsOnlyTheCallersOwnHalf(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	if r := a.Post("/home/day-plan/accept-all", nil); r.Status != http.StatusOK {
		t.Fatalf("accept-all = %d %s", r.Status, r.Raw)
	}
	if committedOf(apitest.MineOf(t, a), "Carry") != true || committedOf(apitest.MineOf(t, b), "Carry") != false {
		t.Fatalf("A: %s B: %s", apitest.DayPlan(t, a).Raw, apitest.DayPlan(t, b).Raw)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents`); got != 1 {
		t.Fatalf("%d commitments, want 1", got)
	}
}

func TestADrainedCheckInReleasesAnUncommittedTwoPersonTaskForBoth(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	apitest.CheckIn(t, a, "drained")

	if rowsFor(t, app) != 0 {
		t.Fatalf("%d rows, want none: no orphan half", rowsFor(t, app))
	}
	for _, c := range []*apitest.Client{a, b} {
		r := apitest.DayPlan(t, c)
		pooled := apitest.TaskList(t, r.Body["pool"])
		if len(pooled) != 1 || pooled[0]["reason"] != "no_energy_left" || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
			t.Fatalf("day plan = %s", r.Raw)
		}
	}
}

func TestACommittedTwoPersonTaskIsPinnedForBothThroughACheckIn(t *testing.T) {
	t.Parallel()
	for _, committer := range []string{"a", "b"} {
		t.Run("committed by "+committer, func(t *testing.T) {
			t.Parallel()
			app, a, b := apitest.DuoHome(t, 2, 3)
			id := apitest.MineOf(t, a)[0]["id"].(string)
			apitest.MustAct(t, map[string]*apitest.Client{"a": a, "b": b}[committer], "accept", id)

			apitest.CheckIn(t, a, "drained")
			apitest.CheckIn(t, b, "low")
			if rowsFor(t, app) != 2 {
				t.Fatalf("%d rows, want both kept", rowsFor(t, app))
			}
			for _, c := range []*apitest.Client{a, b} {
				if m := apitest.MineOf(t, c); len(m) != 1 || m[0]["id"] != id {
					t.Fatalf("mine = %v", m)
				}
			}
		})
	}
}

func TestAPinnedTwoPersonTaskUsesUpTheCallersEnergyInAReplan(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 3, 3)
	apitest.MustAct(t, b, "accept", apitest.MineOf(t, a)[0]["id"].(string)) // the partner promised it
	apitest.CreateChore(t, a, apitest.Chore("Dust", 7, 2, "normal", []string{}))
	apitest.CreateChore(t, a, apitest.Chore("Wipe", 7, 1, "normal", []string{}))
	apitest.Pool(t, a) // opens the Tasks

	apitest.CheckIn(t, a, "normal") // 3 Energy, 2 of it already spent on Carry
	names := map[string]bool{}
	for _, tk := range apitest.MineOf(t, a) {
		names[tk["choreName"].(string)] = true
	}
	if len(names) != 2 || !names["Carry"] || !names["Wipe"] {
		t.Fatalf("mine = %v, want Carry and the Effort-1 Wipe only", names)
	}
	if rowsFor(t, app) != 3 {
		t.Fatalf("%d rows, want 3", rowsFor(t, app))
	}
}

func TestAReplanNeverLeavesExactlyOneRowOfATwoPersonTask(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 2, 3)
	apitest.CreateChore(t, a, apitest.Chore("Dust", 7, 1, "normal", []string{}))
	apitest.Pool(t, a) // opens the Task

	for _, step := range []func(){
		func() { apitest.CheckIn(t, a, "normal") },
		func() { planMe(t, b) },
		func() { apitest.CheckIn(t, b, "energized") },
		func() { apitest.CheckIn(t, a, "low") },
	} {
		step()
		n := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments d JOIN tasks t ON t.id = d.task_id JOIN chores c ON c.id = t.chore_id WHERE c.people = 2`)
		if n != 0 && n != 2 {
			t.Fatalf("%d rows of the two-person Task", n)
		}
	}
}

// halfTask gives the two-person Task to the first Resident only.
type halfTask struct{}

func (halfTask) Name() string { return "stub" }
func (halfTask) Plan(s allocation.State) (allocation.Result, error) {
	var res allocation.Result
	for _, t := range s.Tasks {
		res.DayPlan.Assignments = append(res.DayPlan.Assignments,
			allocation.Assignment{TaskID: t.ID, ResidentID: s.Residents[0].ID, Reason: allocation.ReasonFitsEnergy})
	}
	return res, nil
}

func TestAPlanGivingATwoPersonTaskToOneResidentIsRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.TwoPersonChore("Carry", 2))
	app.UseAllocator(halfTask{})
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	r := apitest.DayPlan(t, a)
	if r.Body["rejected"] != true || len(apitest.TaskList(t, r.Body["mine"])) != 0 || rowsFor(t, app) != 0 {
		t.Fatalf("day plan = %s", r.Raw)
	}
	var kinds []string
	rows, err := app.DB.Query(context.Background(),
		`SELECT v->>'kind' FROM allocation_runs, jsonb_array_elements(reasons->'violations') v`)
	if err != nil {
		t.Fatal(err)
	}
	if kinds, err = pgx.CollectRows(rows, pgx.RowTo[string]); err != nil || !slices.Contains(kinds, "wrong_resident_count") {
		t.Fatalf("violations = %v, %v", kinds, err)
	}
}

func TestACompletionStillWorksForAPartnerLeftHoldingHalf(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.DuoHome(t, 2, 3)
	id := apitest.MineOf(t, a)[0]["id"].(string)
	// The partner's row disappears (for example the Resident left the Home).
	if _, err := app.DB.Exec(context.Background(),
		`DELETE FROM day_plan_assignments WHERE resident_id = $1`, residentIDOf(t, app, "b@example.com")); err != nil {
		t.Fatal(err)
	}
	apitest.CheckIn(t, a, "normal") // a re-plan keeps the lone row instead of dropping it
	apitest.MustAct(t, a, "complete", id)
	if got := completionResidents(t, app); !slices.Equal(got, []string{"a@example.com"}) {
		t.Fatalf("completion residents = %v", got)
	}
}

func TestSwappingATwoPersonTaskStaysRefused(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})
	apitest.SetBaseline(t, b, map[string]any{"monday": 5})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, apitest.TwoPersonChore("Carry", 1))
	apitest.CreateChore(t, a, apitest.Chore("Dust", 7, 1, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	carry := apitest.IDOf(t, apitest.MineOf(t, a), "Carry")
	for _, c := range []*apitest.Client{a, b} {
		for _, tk := range apitest.MineOf(t, c) {
			if tk["choreName"] == "Dust" {
				r := c.Post("/home/swaps", map[string]any{"offeredTaskId": tk["id"], "requestedTaskId": carry})
				wantConflict(t, r, "two_person_task")
				return
			}
		}
	}
	t.Fatal("setup: Dust is not assigned")
}
