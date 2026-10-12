package server_test

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func startApp(t *testing.T) *apitest.App { t.Helper(); return apitest.Start(t) }

// mondayAt is 2 March 2026, a Monday, at hour o'clock UTC (the harness Home's
// zone); its Allocation time is 07:00.
func mondayAt(hour int) time.Time {
	return time.Date(2026, time.March, 2, hour, 0, 0, 0, time.UTC)
}

func TestACheckInBeforeThePlanSetsTodaysEnergy(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 5, "tuesday": 5})
	app.Clock.Set(mondayAt(6))
	createChore(t, me, chore("Dishes", 1, 2, "essential", []string{}))
	createChore(t, me, chore("Mop", 1, 2, "normal", []string{}))
	createChore(t, me, chore("Dust", 1, 2, "nice_to_have", []string{}))
	checkIn(t, me, "low") // 5 * 50% = 2 (rounded down)

	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	r := dayPlan(t, me)
	if got := names(taskList(t, r.Body["mine"])); len(got) != 1 || got[0] != "Dishes" || r.Body["energy"] != float64(2) {
		t.Fatalf("Monday: mine = %v energy = %v, want only Dishes on 2", got, r.Body["energy"])
	}

	// It only affects today: the next day has no Check-in and uses the Baseline.
	app.Clock.Set(mondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	r = dayPlan(t, me)
	if got := names(taskList(t, r.Body["mine"])); len(got) != 2 || r.Body["energy"] != float64(5) {
		t.Fatalf("Tuesday: mine = %v energy = %v, want two Tasks on the Baseline of 5 (the Check-in must not carry over)", got, r.Body["energy"])
	}
}

func TestEveryLevelScalesTheBaseline(t *testing.T) {
	t.Parallel()
	for level, want := range map[string]float64{"drained": 0, "low": 5, "normal": 10, "energized": 13} {
		t.Run(level, func(t *testing.T) {
			t.Parallel()
			app := startApp(t)
			me := homeWithResident(t, app, "a@example.com")
			setBaseline(t, me, map[string]any{"monday": 10})
			app.Clock.Set(mondayAt(6))
			checkIn(t, me, level)
			app.Clock.Set(mondayAt(7))
			app.RunAllocation(t)
			if got := dayPlan(t, me).Body["energy"]; got != want {
				t.Fatalf("%s: energy = %v, want %v", level, got, want)
			}
		})
	}
}

func TestNoCheckInMeansTheBaselineEvenWhenAHousemateChecksIn(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	a := homeWithResident(t, app, "a@example.com")
	b := extraResident(t, app, a, "b@example.com")
	setBaseline(t, a, map[string]any{"monday": 8})
	setBaseline(t, b, map[string]any{"monday": 8})
	app.Clock.Set(mondayAt(6))
	checkIn(t, a, "drained")
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)

	if got := dayPlan(t, a).Body["energy"]; got != float64(0) {
		t.Errorf("A energy = %v, want 0", got)
	}
	if got := dayPlan(t, b).Body["energy"]; got != float64(8) {
		t.Errorf("B energy = %v, want the Baseline 8", got)
	}
}

func TestACheckInWithNoBaselineForTheDayGivesNothingAndNoError(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"tuesday": 5}) // Monday unset
	app.Clock.Set(mondayAt(6))
	createChore(t, me, chore("Dishes", 7, 1, "essential", []string{}))
	checkIn(t, me, "energized")
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)

	r := dayPlan(t, me)
	if r.Body["energy"] != float64(0) || len(taskList(t, r.Body["mine"])) != 0 {
		t.Fatalf("body = %s", r.Raw)
	}
}

func TestADayRestrictionKeepsATaskAwayFromThatResidentOnlyToday(t *testing.T) {
	t.Parallel()
	app := startApp(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 10, "tuesday": 10})
	app.Clock.Set(mondayAt(6))
	createChore(t, me, chore("Move sofa", 1, 3, "normal", []string{"heavy_lifting"}))
	checkIn(t, me, "normal", "heavy_lifting")
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)

	r := dayPlan(t, me)
	if len(taskList(t, r.Body["mine"])) != 0 || reasonOf(taskList(t, r.Body["pool"]), "Move sofa") != "restricted_for_all" {
		t.Fatalf("Monday: %s", r.Raw)
	}

	// Tomorrow the day Restriction is gone, so the Task can be given again.
	app.Clock.Set(mondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	if got := names(taskList(t, dayPlan(t, me).Body["mine"])); len(got) != 1 || got[0] != "Move sofa" {
		t.Fatalf("Tuesday: mine = %v, want Move sofa", got)
	}
}
