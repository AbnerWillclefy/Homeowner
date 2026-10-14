package dayplan_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func startApp(t *testing.T) *apitest.App { t.Helper(); return apitest.Start(t) }

func TestACheckInBeforeThePlanSetsTodaysEnergy(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 5, "tuesday": 5})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 1, 2, "essential", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Mop", 1, 2, "normal", []string{}))
	apitest.CreateChore(t, me, apitest.Chore("Dust", 1, 2, "nice_to_have", []string{}))
	apitest.CheckIn(t, me, "low") // 5 * 50% = 2 (rounded down)

	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	r := apitest.DayPlan(t, me)
	if got := names(apitest.TaskList(t, r.Body["mine"])); len(got) != 1 || got[0] != "Dishes" || r.Body["energy"] != float64(2) {
		t.Fatalf("Monday: mine = %v energy = %v, want only Dishes on 2", got, r.Body["energy"])
	}

	// It only affects today: the next day has no Check-in and uses the Baseline.
	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	r = apitest.DayPlan(t, me)
	if got := names(apitest.TaskList(t, r.Body["mine"])); len(got) != 2 || r.Body["energy"] != float64(5) {
		t.Fatalf("Tuesday: mine = %v energy = %v, want two Tasks on the Baseline of 5 (the Check-in must not carry over)", got, r.Body["energy"])
	}
}

func TestEveryLevelScalesTheBaseline(t *testing.T) {
	t.Parallel()
	for level, want := range map[string]float64{"drained": 0, "low": 5, "normal": 10, "energized": 13} {
		t.Run(level, func(t *testing.T) {
			t.Parallel()
			app := startApp(t)
			me := apitest.HomeWithResident(t, app, "a@example.com")
			apitest.SetBaseline(t, me, map[string]any{"monday": 10})
			app.Clock.Set(apitest.MondayAt(6))
			apitest.CheckIn(t, me, level)
			app.Clock.Set(apitest.MondayAt(7))
			app.RunAllocation(t)
			if got := apitest.DayPlan(t, me).Body["energy"]; got != want {
				t.Fatalf("%s: energy = %v, want %v", level, got, want)
			}
		})
	}
}

func TestNoCheckInMeansTheBaselineEvenWhenAHousemateChecksIn(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 8})
	apitest.SetBaseline(t, b, map[string]any{"monday": 8})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CheckIn(t, a, "drained")
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	if got := apitest.DayPlan(t, a).Body["energy"]; got != float64(0) {
		t.Errorf("A energy = %v, want 0", got)
	}
	if got := apitest.DayPlan(t, b).Body["energy"]; got != float64(8) {
		t.Errorf("B energy = %v, want the Baseline 8", got)
	}
}

func TestACheckInWithNoBaselineForTheDayGivesNothingAndNoError(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"tuesday": 5}) // Monday unset
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 1, "essential", []string{}))
	apitest.CheckIn(t, me, "energized")
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	r := apitest.DayPlan(t, me)
	if r.Body["energy"] != float64(0) || len(apitest.TaskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("body = %s", r.Raw)
	}
}

func TestADayRestrictionKeepsATaskAwayFromThatResidentOnlyToday(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, me, map[string]any{"monday": 10, "tuesday": 10})
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Move sofa", 1, 3, "normal", []string{"heavy_lifting"}))
	apitest.CheckIn(t, me, "normal", "heavy_lifting")
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	r := apitest.DayPlan(t, me)
	if len(apitest.TaskList(t, r.Body["mine"])) != 0 || reasonOf(apitest.TaskList(t, r.Body["pool"]), "Move sofa") != "restricted_for_all" {
		t.Fatalf("Monday: %s", r.Raw)
	}

	// Tomorrow the day Restriction is gone, so the Task can be given again.
	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	if got := names(apitest.TaskList(t, apitest.DayPlan(t, me).Body["mine"])); len(got) != 1 || got[0] != "Move sofa" {
		t.Fatalf("Tuesday: mine = %v, want Move sofa", got)
	}
}
