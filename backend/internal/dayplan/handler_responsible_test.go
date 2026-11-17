package dayplan_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// responsibleHome is A, B and C in one Home with the given Energy on Monday and
// Tuesday, and no plan yet at 06:00 on Monday.
func responsibleHome(t *testing.T, ea, eb, ec int) (app *apitest.App, a, b, c *apitest.Client) {
	t.Helper()
	app = apitest.Start(t)
	a = apitest.HomeWithResident(t, app, "a@example.com")
	b = apitest.ExtraResident(t, app, a, "b@example.com")
	c = apitest.ExtraResident(t, app, a, "c@example.com")
	for cl, e := range map[*apitest.Client]int{a: ea, b: eb, c: ec} {
		apitest.SetBaseline(t, cl, map[string]any{"monday": e, "tuesday": e})
	}
	app.Clock.Set(apitest.MondayAt(6))
	return app, a, b, c
}

// chore creates a Chore of base Effort 2 owned by the Resident of owner.
func ownedChore(t *testing.T, creator *apitest.Client, body map[string]any, owner *apitest.Client) string {
	t.Helper()
	id := apitest.CreateChore(t, creator, body)
	apitest.ExpectStatus(t, creator.Put("/home/chores/"+id+"/responsible",
		map[string]any{"residentId": apitest.ResidentID(t, owner)}), http.StatusNoContent)
	return id
}

func poolEntry(t *testing.T, c *apitest.Client, name string) map[string]any {
	t.Helper()
	for _, tk := range apitest.TaskList(t, apitest.DayPlan(t, c).Body["pool"]) {
		if tk["choreName"] == name {
			return tk
		}
	}
	t.Fatalf("no %q in the pool: %s", name, apitest.DayPlan(t, c).Raw)
	return nil
}

func holds(t *testing.T, c *apitest.Client, name string) bool {
	t.Helper()
	return reasonOf(apitest.MineOf(t, c), name) != "missing"
}

func TestAOneDayTaskIsProposedOnlyToItsResponsibleResident(t *testing.T) {
	t.Parallel()
	app, a, b, _ := responsibleHome(t, 5, 3, 1)
	ownedChore(t, a, apitest.Chore("Owned", 7, 2, "normal", []string{}), b) // A has the most Energy
	allocate(app, t)
	if !holds(t, b, "Owned") || holds(t, a, "Owned") {
		t.Fatalf("A: %s\nB: %s", apitest.DayPlan(t, a).Raw, apitest.DayPlan(t, b).Raw)
	}
}

func TestATaskWaitsForItsResponsibleResidentAndItsEffortKeepsGrowing(t *testing.T) {
	t.Parallel()
	app, a, b, _ := responsibleHome(t, 0, 5, 5) // A has no Energy on either day
	ownedChore(t, a, apitest.Recurring("Bath", 1, 1, true), a)
	allocate(app, t)
	if tk := poolEntry(t, b, "Bath"); tk["reason"] != "waiting_for_responsible" || tk["currentEffort"] != float64(1) {
		t.Fatalf("Monday: %v", tk)
	}
	apitest.AtDay(app, 3) // Tuesday: one window missed
	app.RunAllocation(t)
	for _, c := range []*apitest.Client{a, b} {
		if tk := poolEntry(t, c, "Bath"); tk["reason"] != "waiting_for_responsible" || tk["currentEffort"] != float64(2) {
			t.Fatalf("Tuesday: %v", tk)
		}
	}
	if holds(t, b, "Bath") {
		t.Fatal("B was given A's Task")
	}
}

func TestATaskWaitsWhenTheResponsibleResidentCannotDoIt(t *testing.T) {
	t.Parallel()
	for name, setup := range map[string]func(t *testing.T, app *apitest.App, a *apitest.Client){
		"not enough Energy": func(t *testing.T, _ *apitest.App, a *apitest.Client) {
			apitest.SetBaseline(t, a, map[string]any{"monday": 1})
		},
		"no Baseline that day": func(t *testing.T, _ *apitest.App, a *apitest.Client) {
			apitest.SetBaseline(t, a, map[string]any{"monday": 0, "tuesday": 5})
		},
		"drained": func(t *testing.T, _ *apitest.App, a *apitest.Client) { apitest.CheckIn(t, a, "drained") },
		"a one-day restriction": func(t *testing.T, _ *apitest.App, a *apitest.Client) {
			apitest.CheckIn(t, a, "normal", "heavy_lifting")
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, a, b, _ := responsibleHome(t, 5, 5, 5)
			ownedChore(t, a, apitest.Chore("Owned", 7, 2, "normal", []string{"heavy_lifting"}), a)
			setup(t, app, a)
			allocate(app, t)
			if tk := poolEntry(t, b, "Owned"); tk["reason"] != "waiting_for_responsible" {
				t.Fatalf("pool entry = %v", tk)
			}
			if holds(t, a, "Owned") || holds(t, b, "Owned") {
				t.Fatal("somebody holds it")
			}
		})
	}
}

func TestATaskOnAForbiddenWeekdayKeepsItsWeekdayReason(t *testing.T) {
	t.Parallel()
	app, a, _, _ := responsibleHome(t, 0, 5, 5)
	apitest.AtDay(app, 3)
	ownedChore(t, a, apitest.Chore("Owned", 1, 1, "normal", []string{}, 2), a) // Tuesdays only; A has no Energy
	app.RunAllocation(t)
	apitest.AtDay(app, 4) // Wednesday: overdue, but the day is forbidden
	app.RunAllocation(t)
	if tk := poolEntry(t, a, "Owned"); tk["reason"] != "weekday_not_allowed" {
		t.Fatalf("pool entry = %v", tk)
	}
}

func TestATwoPersonTaskIncludesTheResponsibleResidentOrWaits(t *testing.T) {
	t.Parallel()
	app, a, b, c := responsibleHome(t, 2, 5, 4)
	ownedChore(t, a, apitest.TwoPersonChore("Carry", 2), a)
	allocate(app, t)
	if !holds(t, a, "Carry") || !holds(t, b, "Carry") || holds(t, c, "Carry") {
		t.Fatalf("A: %s\nB: %s\nC: %s", apitest.DayPlan(t, a).Raw, apitest.DayPlan(t, b).Raw, apitest.DayPlan(t, c).Raw)
	}

	app, a, b, c = responsibleHome(t, 0, 5, 4)
	ownedChore(t, a, apitest.TwoPersonChore("Carry", 2), a)
	allocate(app, t)
	if tk := poolEntry(t, b, "Carry"); tk["reason"] != "waiting_for_responsible" || holds(t, c, "Carry") {
		t.Fatalf("pool entry = %v", tk)
	}
}

// waitingFor is a Home planned while A, who is responsible for "Owned", had no
// Energy; B and C are fine.
func waitingFor(t *testing.T) (app *apitest.App, a, b, c *apitest.Client) {
	t.Helper()
	app, a, b, c = responsibleHome(t, 0, 5, 5)
	ownedChore(t, a, apitest.Chore("Owned", 7, 2, "normal", []string{}), a)
	allocate(app, t)
	if tk := poolEntry(t, b, "Owned"); tk["reason"] != "waiting_for_responsible" {
		t.Fatalf("setup: %v", tk)
	}
	return app, a, b, c
}

func TestResponsibilityDoesNotBindTakeOrCompleteFromThePool(t *testing.T) {
	t.Parallel()
	_, _, b, _ := waitingFor(t)
	r := apitest.MustAct(t, b, "take", poolEntry(t, b, "Owned")["id"].(string))
	if !holds(t, b, "Owned") {
		t.Fatalf("not taken: %s", r.Raw)
	}

	_, a, _, c := waitingFor(t)
	apitest.MustAct(t, c, "complete", poolEntry(t, a, "Owned")["id"].(string))
	if apitest.TaskList(t, apitest.DayPlan(t, c).Body["doneToday"])[0]["choreName"] != "Owned" {
		t.Fatalf("not done: %s", apitest.DayPlan(t, c).Raw)
	}
}

func TestResponsibilityDoesNotBindASwap(t *testing.T) {
	t.Parallel()
	app, a, b, c := responsibleHome(t, 0, 4, 4)
	ownedChore(t, a, apitest.Chore("OfB", 7, 2, "normal", []string{}), b)
	ownedChore(t, a, apitest.Chore("OfC", 7, 2, "normal", []string{}), c)
	allocate(app, t)
	ofB, ofC := apitest.MineOf(t, b), apitest.MineOf(t, c)
	if len(ofB) != 1 || ofB[0]["choreName"] != "OfB" || len(ofC) != 1 || ofC[0]["choreName"] != "OfC" {
		t.Fatalf("setup: %v %v", ofB, ofC)
	}
	r := mustOffer(t, b, ofB[0]["id"].(string), ofC[0]["id"].(string))
	_ = r
	mustSwapAct(t, c, swapsOf(t, c, "incoming")[0]["id"].(string), "accept")
	if !holds(t, b, "OfC") || !holds(t, c, "OfB") {
		t.Fatalf("B: %s\nC: %s", apitest.DayPlan(t, b).Raw, apitest.DayPlan(t, c).Raw)
	}
}

func TestACheckInByTheResponsibleResidentPicksUpTheWaitingTask(t *testing.T) {
	t.Parallel()
	app, a, b, _ := waitingFor(t)
	app.Clock.Set(apitest.MondayAt(9))
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})

	apitest.CheckIn(t, b, "normal") // someone else's Check-in leaves it waiting
	if tk := poolEntry(t, b, "Owned"); tk["reason"] != "waiting_for_responsible" {
		t.Fatalf("after B's Check-in: %v", tk)
	}
	apitest.CheckIn(t, a, "normal")
	if !holds(t, a, "Owned") {
		t.Fatalf("after A's Check-in: %s", apitest.DayPlan(t, a).Raw)
	}
}

func TestGetMyTasksRightAwayHonoursResponsibility(t *testing.T) {
	t.Parallel()
	app, a, b, _ := waitingFor(t)
	app.Clock.Set(apitest.MondayAt(9))
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})

	if r := planMe(t, b); r.Status != http.StatusOK || holds(t, b, "Owned") {
		t.Fatalf("B planned it: %s", r.Raw)
	}
	if tk := poolEntry(t, b, "Owned"); tk["reason"] != "waiting_for_responsible" {
		t.Fatalf("pool entry = %v", tk)
	}
	if r := planMe(t, a); r.Status != http.StatusOK || !holds(t, a, "Owned") {
		t.Fatalf("A did not pick it up: %s", r.Raw)
	}
}
