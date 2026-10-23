package streak_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
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
	me := apitest.HomeWithResident(t, app, "a@example.com")
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = 4
	}
	apitest.SetBaseline(t, me, all)
	app.Clock.Set(at(2, 6))
	for _, n := range names {
		apitest.CreateChore(t, me, apitest.Chore(n, 1, 2, "normal", []string{}))
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
	id := apitest.MineOf(t, me)[0]["id"].(string)
	apitest.MustAct(t, me, "accept", id)
	wantStreak(t, me, 0, false) // a Commitment still open adds nothing
	apitest.MustAct(t, me, "complete", id)
	wantStreak(t, me, 1, true)

	// Tuesday: Monday is final and grew; nothing today pauses.
	app.Clock.Set(at(3, 9))
	wantStreak(t, me, 1, false)
	allocateOn(app, t, 3) // a new Task is proposed and ignored
	wantStreak(t, me, 1, false)

	// Wednesday: a Drained Check-in pauses.
	allocateOn(app, t, 4)
	apitest.CheckIn(t, me, "drained")
	wantStreak(t, me, 1, false)

	// Thursday: a Commitment left undone. Today is not judged yet.
	allocateOn(app, t, 5)
	apitest.MustAct(t, me, "accept", apitest.MineOf(t, me)[0]["id"].(string))
	wantStreak(t, me, 1, false)

	// Friday: Thursday is final and broke.
	app.Clock.Set(at(6, 9))
	wantStreak(t, me, 0, false)
}

func TestRefusingOrIgnoringNeverBreaksTheStreak(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")

	allocateOn(app, t, 2)
	mine := apitest.MineOf(t, me)
	if len(mine) != 2 {
		t.Fatalf("setup: %v", mine)
	}
	apitest.MustAct(t, me, "complete", apitest.IDOf(t, mine, "Dishes"))
	apitest.MustAct(t, me, "refuse", apitest.IDOf(t, mine, "Mop"))
	wantStreak(t, me, 1, true)

	// Tuesday: both proposed again, one refused, one ignored.
	allocateOn(app, t, 3)
	wantStreak(t, me, 1, false)
	if mine := apitest.MineOf(t, me); len(mine) > 0 {
		apitest.MustAct(t, me, "refuse", mine[0]["id"].(string))
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
	for _, tk := range apitest.MineOf(t, me) {
		apitest.MustAct(t, me, "refuse", tk["id"].(string))
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
	me := apitest.HomeWithResident(t, app, "a@example.com")
	r := me.Get("/home/streak")
	if r.Status != http.StatusOK || r.Body["date"] != "2026-03-02" || r.Body["current"] != float64(0) || r.Body["todayGrew"] != false {
		t.Fatalf("new Resident = %d %s", r.Status, r.Raw)
	}
}

func TestACompletionByEitherPartnerGrowsBothStreaks(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 4, 4)
	app.Clock.Set(at(2, 9))
	task := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", task)
	apitest.MustAct(t, b, "accept", task)
	wantStreak(t, a, 0, false)
	wantStreak(t, b, 0, false)

	apitest.MustAct(t, b, "complete", task)
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
	id := apitest.MineOf(t, me)[0]["id"].(string)
	apitest.MustAct(t, me, "accept", id)

	// Tuesday: Monday's Commitment is undone and final; the Task is done now.
	allocateOn(app, t, 3)
	wantStreak(t, me, 0, false)
	apitest.MustAct(t, me, "complete", apitest.IDOf(t, apitest.MineOf(t, me), "Dishes"))
	// Tuesday grew, Monday stays a break.
	wantStreak(t, me, 1, true)
	app.Clock.Set(at(4, 9))
	wantStreak(t, me, 1, false)
}

func TestTodayKeepsCountingWhenAnotherCommitmentIsAdded(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")
	allocateOn(app, t, 2)
	mine := apitest.MineOf(t, me)
	apitest.MustAct(t, me, "complete", apitest.IDOf(t, mine, "Dishes"))
	wantStreak(t, me, 1, true)
	apitest.MustAct(t, me, "accept", apitest.IDOf(t, mine, "Mop"))
	// Another Commitment after growing: today still counts, nothing breaks.
	wantStreak(t, me, 1, true)
	app.Clock.Set(at(2, 23))
	wantStreak(t, me, 1, true)
}

func TestAPartiallyFinishedDayKeepsTheStreak(t *testing.T) {
	t.Parallel()
	app, me := dailyHome(t, "Dishes", "Mop")

	allocateOn(app, t, 2)
	mine := apitest.MineOf(t, me)
	if len(mine) != 2 {
		t.Fatalf("setup: %v", mine)
	}
	apitest.MustAct(t, me, "accept", apitest.IDOf(t, mine, "Dishes"))
	apitest.MustAct(t, me, "accept", apitest.IDOf(t, mine, "Mop"))
	wantStreak(t, me, 0, false)
	apitest.MustAct(t, me, "complete", apitest.IDOf(t, mine, "Dishes"))
	wantStreak(t, me, 1, true) // Mop is still Committed and open

	// Tuesday: Monday is final with Mop undone, and it grew.
	app.Clock.Set(at(3, 9))
	wantStreak(t, me, 1, false)
}

func TestLeavingTheHomeAndJoiningAnotherStartsAtZero(t *testing.T) {
	t.Parallel()
	app, _, b := apitest.TwoResidents(t)
	app.Clock.Set(at(2, 9))
	apitest.MustAct(t, b, "complete", apitest.MineOf(t, b)[0]["id"].(string))
	wantStreak(t, b, 1, true)

	if r := apitest.LeaveHome(b); r.Status != http.StatusNoContent {
		t.Fatalf("leave = %d %s", r.Status, r.Raw)
	}
	if r := b.Post("/home", apitest.HomeBody("UTC", "07:00")); r.Status != http.StatusCreated {
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
	if r := me.Post("/home", apitest.HomeBody("Pacific/Auckland", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = 4
	}
	apitest.SetBaseline(t, me, all)
	app.Clock.Set(at(2, 6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 1, 2, "normal", []string{}))

	// 18:00 UTC on the 2nd is 07:00 on the 3rd in Auckland: the Allocation time.
	app.Clock.Set(at(2, 18))
	app.RunAllocation(t)
	app.Clock.Set(at(2, 20))

	if got := streakOf(t, me); got.date != "2026-03-03" {
		t.Fatalf("date = %q, want the Home-local 2026-03-03", got.date)
	}
	apitest.MustAct(t, me, "complete", apitest.MineOf(t, me)[0]["id"].(string))
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
