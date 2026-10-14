package dayplan_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestRefuseReturnsTheTaskToThePoolAndChangesNothingElse(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	mine := mineOf(t, a)
	refused := mine[0]["choreName"].(string)
	kept := mine[1]["choreName"].(string)
	bMine := names(mineOf(t, b))

	r := mustAct(t, a, "refuse", mine[0]["id"].(string))
	if got := names(taskList(t, r.Body["mine"])); !slices.Equal(got, []string{kept}) {
		t.Fatalf("mine = %v, want only %s", got, kept)
	}
	if reasonOf(taskList(t, r.Body["pool"]), refused) != "refused" {
		t.Fatalf("pool = %s", r.Raw)
	}
	if got := names(mineOf(t, b)); !slices.Equal(got, bMine) {
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
	_, a, b := twoResidents(t)
	mine := mineOf(t, a)
	mustAct(t, a, "accept", mine[0]["id"].(string))
	wantConflict(t, act(a, "refuse", mine[0]["id"].(string)), "already_committed")
	if got := len(mineOf(t, a)); got != 2 {
		t.Fatalf("mine = %d, the committed Task must stay", got)
	}
	wantConflict(t, act(a, "refuse", mineOf(t, b)[0]["id"].(string)), "not_proposed")
	wantConflict(t, act(a, "refuse", taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)), "not_proposed")
}

func TestRefuseNeedsATodayPlan(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	app.Clock.Set(mondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	wantConflict(t, act(me, "refuse", apitest.Pool(t, me)[0]["id"].(string)), "no_plan_today")
}

func TestARefusedTaskStaysRefusedThroughEveryReplan(t *testing.T) {
	t.Parallel()
	replans := []struct {
		name string
		do   func(t *testing.T, a, b *apitest.Client)
	}{
		{"the refuser's Check-in", func(t *testing.T, a, b *apitest.Client) { checkIn(t, a, "energized") }},
		{"right away", func(t *testing.T, a, b *apitest.Client) {
			if r := planMe(t, a); r.Status != http.StatusOK {
				t.Fatalf("POST /me = %d %s", r.Status, r.Raw)
			}
		}},
		{"another Resident's Check-in", func(t *testing.T, a, b *apitest.Client) { checkIn(t, b, "energized") }},
	}
	for _, tc := range replans {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, a, b := twoResidents(t)
			apitest.SetBaseline(t, a, map[string]any{"monday": 8})
			apitest.SetBaseline(t, b, map[string]any{"monday": 8})
			refused := mineOf(t, a)[0]
			mustAct(t, a, "refuse", refused["id"].(string))

			tc.do(t, a, b)
			for _, c := range []*apitest.Client{a, b} {
				r := dayPlan(t, c)
				for _, tk := range append(taskList(t, r.Body["mine"]), others(t, r)...) {
					if tk["id"] == refused["id"] {
						t.Fatalf("the refused Task was handed out again: %s", r.Raw)
					}
				}
			}
			name := refused["choreName"].(string)
			if got := reasonOf(taskList(t, dayPlan(t, a).Body["pool"]), name); got != "refused" {
				t.Fatalf("reason = %v, want refused: %s", got, dayPlan(t, a).Raw)
			}
		})
	}
}

// others is every Task listed under another Resident.
func others(t *testing.T, r apitest.Response) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, o := range r.Body["others"].([]any) {
		out = append(out, taskList(t, o.(map[string]any)["tasks"])...)
	}
	return out
}

func TestARefusedTaskMayBeAssignedAtTheNextAllocation(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 2, "tuesday": 2})
	app.Clock.Set(mondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	mustAct(t, me, "refuse", mineOf(t, me)[0]["id"].(string))
	checkIn(t, me, "normal")
	if len(mineOf(t, me)) != 0 {
		t.Fatalf("refused Task came back today: %s", dayPlan(t, me).Raw)
	}

	app.Clock.Set(mondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	mine := mineOf(t, me)
	if len(mine) != 1 || mine[0]["committed"] != false {
		t.Fatalf("tomorrow: %s", dayPlan(t, me).Raw)
	}
}
