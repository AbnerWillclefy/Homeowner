package server_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// The Streak is read on a fake clock. March 2026: the 2nd is a Monday. The
// harness Home is in UTC and its Allocation time is 07:00.

// at is day n of March 2026 at hour o'clock UTC.
func at(day, hour int) time.Time {
	return time.Date(2026, time.March, day, hour, 0, 0, 0, time.UTC)
}

// allocateOn runs the Allocation at 07:00 on day n of March, then leaves the
// clock at 09:00 the same day.
func allocateOn(app *apitest.App, t *testing.T, day int) {
	t.Helper()
	app.Clock.Set(at(day, 7))
	app.RunAllocation(t)
	app.Clock.Set(at(day, 9))
}

type streakReading struct {
	date      string
	current   int
	todayGrew bool
}

func streakOf(t *testing.T, c *apitest.Client) streakReading {
	t.Helper()
	r := c.Get("/home/streak")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/streak = %d %s", r.Status, r.Raw)
	}
	cur, ok := r.Body["current"].(float64)
	grew, ok2 := r.Body["todayGrew"].(bool)
	date, ok3 := r.Body["date"].(string)
	if !ok || !ok2 || !ok3 {
		t.Fatalf("bad body: %s", r.Raw)
	}
	return streakReading{date, int(cur), grew}
}

func wantStreak(t *testing.T, c *apitest.Client, current int, todayGrew bool) {
	t.Helper()
	got := streakOf(t, c)
	if got.current != current || got.todayGrew != todayGrew {
		t.Fatalf("Streak = %+v, want current %d, todayGrew %v", got, current, todayGrew)
	}
}

// dailyHome is one Resident with Energy 4 every day and the given Chores, each
// due every day, created before the first Allocation.
func dailyHome(t *testing.T, names ...string) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = 4
	}
	setBaseline(t, me, all)
	app.Clock.Set(at(2, 6))
	for _, n := range names {
		createChore(t, me, chore(n, 1, 2, "normal", []string{}))
	}
	return app, me
}

func TestTheStreakGrowsPausesAndBreaksOnTheFakeClock(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes")

	// Monday: accept and complete. Today grows, so it already counts.
	allocateOn(app, t, 2)
	if got := streakOf(t, me); got.current != 0 || got.date != "2026-03-02" {
		t.Fatalf("before any Completion = %+v", got)
	}
	id := mineOf(t, me)[0]["id"].(string)
	mustAct(t, me, "accept", id)
	wantStreak(t, me, 0, false) // a Commitment still open adds nothing
	mustAct(t, me, "complete", id)
	wantStreak(t, me, 1, true)

	// Tuesday: Monday is final and grew; nothing today pauses.
	app.Clock.Set(at(3, 9))
	wantStreak(t, me, 1, false)
	allocateOn(app, t, 3) // a new Task is proposed and ignored
	wantStreak(t, me, 1, false)

	// Wednesday: a Drained Check-in pauses.
	allocateOn(app, t, 4)
	checkIn(t, me, "drained")
	wantStreak(t, me, 1, false)

	// Thursday: a Commitment left undone. Today is not judged yet.
	allocateOn(app, t, 5)
	mustAct(t, me, "accept", mineOf(t, me)[0]["id"].(string))
	wantStreak(t, me, 1, false)

	// Friday: Thursday is final and broke.
	app.Clock.Set(at(6, 9))
	wantStreak(t, me, 0, false)
}

func TestRefusingOrIgnoringNeverBreaksTheStreak(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")

	allocateOn(app, t, 2)
	mine := mineOf(t, me)
	if len(mine) != 2 {
		t.Fatalf("setup: %v", mine)
	}
	mustAct(t, me, "complete", idOf(t, mine, "Dishes"))
	mustAct(t, me, "refuse", idOf(t, mine, "Mop"))
	wantStreak(t, me, 1, true)

	// Tuesday: both proposed again, one refused, one ignored.
	allocateOn(app, t, 3)
	wantStreak(t, me, 1, false)
	if mine := mineOf(t, me); len(mine) > 0 {
		mustAct(t, me, "refuse", mine[0]["id"].(string))
	}
	wantStreak(t, me, 1, false)

	// Wednesday and Thursday: ignored entirely.
	allocateOn(app, t, 4)
	allocateOn(app, t, 5)
	app.Clock.Set(at(6, 9))
	wantStreak(t, me, 1, false)
}

func TestRefusingEverythingOnAFreshResidentGivesZeroNotAGrow(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")
	allocateOn(app, t, 2)
	for _, tk := range mineOf(t, me) {
		mustAct(t, me, "refuse", tk["id"].(string))
	}
	wantStreak(t, me, 0, false)
	app.Clock.Set(at(3, 9))
	wantStreak(t, me, 0, false)
}

func TestTheStreakIsReadAsJSONAndNeedsAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	app.Clock.Set(at(2, 9))
	if r := app.Get("/home/streak"); r.Status != http.StatusUnauthorized {
		t.Fatalf("without a token = %d %s", r.Status, r.Raw)
	}
	lonely := app.SignInAs("lonely@example.com")
	if r := lonely.Get("/home/streak"); r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Fatalf("without a Home = %d %s", r.Status, r.Raw)
	}
	me := homeWithResident(t, app, "a@example.com")
	r := me.Get("/home/streak")
	if r.Status != http.StatusOK || r.Body["date"] != "2026-03-02" || r.Body["current"] != float64(0) || r.Body["todayGrew"] != false {
		t.Fatalf("new Resident = %d %s", r.Status, r.Raw)
	}
}

func TestACompletionByEitherPartnerGrowsBothStreaks(t *testing.T) {
	t.Parallel()
	app, a, b := duoHome(t, 4, 4)
	app.Clock.Set(at(2, 9))
	task := mineOf(t, a)[0]["id"].(string)
	mustAct(t, a, "accept", task)
	mustAct(t, b, "accept", task)
	wantStreak(t, a, 0, false)
	wantStreak(t, b, 0, false)

	mustAct(t, b, "complete", task)
	wantStreak(t, a, 1, true)
	wantStreak(t, b, 1, true)
	app.Clock.Set(at(3, 9))
	wantStreak(t, a, 1, false)
	wantStreak(t, b, 1, false)
}

func TestCompletingTheNextDayDoesNotRepairTheBreak(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes")
	allocateOn(app, t, 2)
	id := mineOf(t, me)[0]["id"].(string)
	mustAct(t, me, "accept", id)

	// Tuesday: Monday's Commitment is undone and final; the Task is done now.
	allocateOn(app, t, 3)
	wantStreak(t, me, 0, false)
	mustAct(t, me, "complete", idOf(t, mineOf(t, me), "Dishes"))
	// Tuesday grew, Monday stays a break.
	wantStreak(t, me, 1, true)
	app.Clock.Set(at(4, 9))
	wantStreak(t, me, 1, false)
}

func TestTodayWithAnOpenCommitmentDoesNotBreak(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")
	allocateOn(app, t, 2)
	mine := mineOf(t, me)
	mustAct(t, me, "complete", idOf(t, mine, "Dishes"))
	wantStreak(t, me, 1, true)
	mustAct(t, me, "accept", idOf(t, mine, "Mop"))
	// Another Commitment after growing: today's +1 waits for it, nothing breaks.
	wantStreak(t, me, 0, false)
	app.Clock.Set(at(2, 23))
	wantStreak(t, me, 0, false)
}

func TestLeavingTheHomeAndJoiningAnotherStartsAtZero(t *testing.T) {
	t.Parallel()
	app, _, b := twoResidents(t)
	app.Clock.Set(at(2, 9))
	mustAct(t, b, "complete", mineOf(t, b)[0]["id"].(string))
	wantStreak(t, b, 1, true)

	if r := leaveHome(b); r.Status != http.StatusNoContent {
		t.Fatalf("leave = %d %s", r.Status, r.Raw)
	}
	if r := b.Post("/home", homeBody("UTC", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("new Home = %d %s", r.Status, r.Raw)
	}
	wantStreak(t, b, 0, false)
}

// The Streak counts days in the Home's own zone (ADR 0003). Auckland is UTC+13
// in March, so 20:00 UTC on the 2nd is already 09:00 on the 3rd at home.
func TestTheStreakCountsTheHomeLocalDayNotTheUTCDay(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", homeBody("Pacific/Auckland", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = 4
	}
	setBaseline(t, me, all)
	app.Clock.Set(at(2, 6))
	createChore(t, me, chore("Dishes", 1, 2, "normal", []string{}))

	// 18:00 UTC on the 2nd is 07:00 on the 3rd in Auckland: the Allocation time.
	app.Clock.Set(at(2, 18))
	app.RunAllocation(t)
	app.Clock.Set(at(2, 20))

	if got := streakOf(t, me); got.date != "2026-03-03" {
		t.Fatalf("date = %q, want the Home-local 2026-03-03", got.date)
	}
	mustAct(t, me, "complete", mineOf(t, me)[0]["id"].(string))
	wantStreak(t, me, 1, true)

	// 10:59 UTC on the 3rd is 23:59 at home: the Completion still counts today.
	app.Clock.Set(time.Date(2026, time.March, 3, 10, 59, 0, 0, time.UTC))
	if got := streakOf(t, me); got.date != "2026-03-03" || got.current != 1 || !got.todayGrew {
		t.Fatalf("before local midnight = %+v", got)
	}
	// Local midnight: the 4th begins at home, the 3rd is final and grew.
	app.Clock.Set(time.Date(2026, time.March, 3, 11, 0, 0, 0, time.UTC))
	if got := streakOf(t, me); got.date != "2026-03-04" || got.current != 1 || got.todayGrew {
		t.Fatalf("after local midnight = %+v", got)
	}
}
