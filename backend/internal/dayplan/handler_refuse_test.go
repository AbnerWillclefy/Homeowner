package dayplan_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestRefuseReturnsTheTaskToThePoolAndChangesNothingElse(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	refused := mine[0]["choreName"].(string)
	kept := mine[1]["choreName"].(string)
	bMine := names(apitest.MineOf(t, b))

	r := apitest.MustAct(t, a, "refuse", mine[0]["id"].(string))
	if got := names(apitest.TaskList(t, r.Body["mine"])); !slices.Equal(got, []string{kept}) {
		t.Fatalf("mine = %v, want only %s", got, kept)
	}
	if reasonOf(apitest.TaskList(t, r.Body["pool"]), refused) != "refused" {
		t.Fatalf("pool = %s", r.Raw)
	}
	if got := names(apitest.MineOf(t, b)); !slices.Equal(got, bMine) {
		t.Fatalf("B's Tasks changed from %v to %v", bMine, got)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`); got != 3 {
		t.Fatalf("%d assignments, want 3", got)
	}
	// No penalty: nothing is recorded against the Resident.
	if got := apitest.Count(t, app, `SELECT count(*) FROM task_residents`); got != 0 {
		t.Fatalf("%d commitments", got)
	}
}

func TestRefuseIsRefusedAfterAcceptOrForSomeoneElsesTask(t *testing.T) {
	t.Parallel()
	_, a, b := apitest.TwoResidents(t)
	mine := apitest.MineOf(t, a)
	apitest.MustAct(t, a, "accept", mine[0]["id"].(string))
	wantConflict(t, apitest.Act(a, "refuse", mine[0]["id"].(string)), "already_committed")
	if got := len(apitest.MineOf(t, a)); got != 2 {
		t.Fatalf("mine = %d, the committed Task must stay", got)
	}
	wantConflict(t, apitest.Act(a, "refuse", apitest.MineOf(t, b)[0]["id"].(string)), "not_proposed")
	wantConflict(t, apitest.Act(a, "refuse", apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"])[0]["id"].(string)), "not_proposed")
}

func TestRefuseNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, apitest.Act(me, "refuse", apitest.Pool(t, me)[0]["id"].(string)), "no_plan_today")
}

func TestARefusedTaskStaysRefusedThroughEveryReplan(t *testing.T) {
	t.Parallel()
	replans := []struct {
		name string
		do   func(t *testing.T, a, b *apitest.Client)
	}{
		{"the refuser's Check-in", func(t *testing.T, a, b *apitest.Client) { apitest.CheckIn(t, a, "energized") }},
		{"right away", func(t *testing.T, a, b *apitest.Client) {
			if r := planMe(t, a); r.Status != http.StatusOK {
				t.Fatalf("POST /me = %d %s", r.Status, r.Raw)
			}
		}},
		{"another Resident's Check-in", func(t *testing.T, a, b *apitest.Client) { apitest.CheckIn(t, b, "energized") }},
	}
	for _, tc := range replans {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, a, b := apitest.TwoResidents(t)
			apitest.SetBaseline(t, a, map[string]any{"monday": 8})
			apitest.SetBaseline(t, b, map[string]any{"monday": 8})
			refused := apitest.MineOf(t, a)[0]
			apitest.MustAct(t, a, "refuse", refused["id"].(string))

			tc.do(t, a, b)
			for _, c := range []*apitest.Client{a, b} {
				r := apitest.DayPlan(t, c)
				for _, tk := range append(apitest.TaskList(t, r.Body["mine"]), others(t, r)...) {
					if tk["id"] == refused["id"] {
						t.Fatalf("the refused Task was handed out again: %s", r.Raw)
					}
				}
			}
			name := refused["choreName"].(string)
			if got := reasonOf(apitest.TaskList(t, apitest.DayPlan(t, a).Body["pool"]), name); got != "refused" {
				t.Fatalf("reason = %v, want refused: %s", got, apitest.DayPlan(t, a).Raw)
			}
		})
	}
}

// others is every Task listed under another Resident.
func others(t *testing.T, r apitest.Response) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, o := range r.Body["others"].([]any) {
		out = append(out, apitest.TaskList(t, o.(map[string]any)["tasks"])...)
	}
	return out
}

func TestARefusedTaskMayBeAssignedAtTheNextAllocation(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 2, "tuesday": 2})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	apitest.MustAct(t, me, "refuse", apitest.MineOf(t, me)[0]["id"].(string))
	apitest.CheckIn(t, me, "normal")
	if len(apitest.MineOf(t, me)) != 0 {
		t.Fatalf("refused Task came back today: %s", apitest.DayPlan(t, me).Raw)
	}

	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	mine := apitest.MineOf(t, me)
	if len(mine) != 1 || mine[0]["committed"] != false {
		t.Fatalf("tomorrow: %s", apitest.DayPlan(t, me).Raw)
	}
}
