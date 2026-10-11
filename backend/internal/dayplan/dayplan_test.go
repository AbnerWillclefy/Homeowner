package dayplan_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// utc is a fake-clock instant on a March 2026 day (1 March is a Sunday, so the
// 2nd is a Monday and the 4th, where the harness starts, a Wednesday).
func utc(day, hour, min int) time.Time {
	return time.Date(2026, time.March, day, hour, min, 0, 0, time.UTC)
}

// newHome signs email in and creates a Home for them in tz with the Allocation
// time at ("HH:MM").
func newHome(t *testing.T, app *apitest.App, email, tz, at string) *apitest.Client {
	t.Helper()
	c := app.SignInAs(email)
	r := c.Post("/home", map[string]any{"timezone": tz, "allocationTime": at})
	if r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	return c
}

// runs counts the Allocation runs recorded for every Home.
func runs(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM allocation_runs`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestAHomeIsPlannedOnceAtItsAllocationTimeInItsZone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	// Sao Paulo is UTC-3 all year since 2019: 07:00 there is 10:00 UTC.
	newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")

	steps := []struct {
		at   time.Time
		want int
	}{
		{utc(4, 9, 59), 0},  // 06:59 local
		{utc(4, 10, 0), 1},  // 07:00 local
		{utc(4, 10, 15), 1}, // later ticks the same day add none
		{utc(4, 15, 0), 1},
		{utc(4, 23, 59), 1}, // 20:59 local, still the 4th there
		{utc(5, 2, 59), 1},  // 23:59 local
		{utc(5, 3, 0), 1},   // midnight local: new day, but 00:00 is before 07:00
		{utc(5, 9, 59), 1},
		{utc(5, 10, 0), 2}, // next local day plans again
	}
	for _, s := range steps {
		app.Clock.Set(s.at)
		app.RunAllocation(t)
		if got := runs(t, app); got != s.want {
			t.Fatalf("at %s: %d runs, want %d", s.at.Format(time.RFC3339), got, s.want)
		}
	}
}

func TestOnlyTheHomeWhoseTimeHasArrivedIsPlanned(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "sp@example.com", "America/Sao_Paulo", "07:00")   // 10:00 UTC
	newHome(t, app, "la@example.com", "America/Los_Angeles", "07:00") // 15:00 UTC, still 02:00 at 10:00 UTC

	app.Clock.Set(utc(4, 10, 0))
	sum := app.RunAllocation(t)
	if sum.Planned != 1 {
		t.Fatalf("summary = %+v, want exactly one Home planned", sum)
	}
	var zone string
	if err := app.DB.QueryRow(context.Background(),
		`SELECT h.timezone FROM allocation_runs r JOIN homes h ON h.id = r.home_id`).Scan(&zone); err != nil {
		t.Fatal(err)
	}
	if zone != "America/Sao_Paulo" {
		t.Fatalf("planned %s, want America/Sao_Paulo", zone)
	}
}

func TestAMissedTickStillPlansTheHomeOnce(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")

	app.Clock.Set(utc(4, 10, 30)) // the 10:00 and 10:15 ticks never ran
	app.RunAllocation(t)
	app.Clock.Set(utc(4, 10, 45))
	app.RunAllocation(t)
	if got := runs(t, app); got != 1 {
		t.Fatalf("%d runs, want 1", got)
	}
}

func TestADaylightSavingGapStillPlansTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	// New York springs forward on 8 March 2026: 02:00 does not exist, the clock
	// goes from 01:59 EST to 03:00 EDT (07:00 UTC).
	newHome(t, app, "a@example.com", "America/New_York", "02:30")

	app.Clock.Set(utc(8, 6, 59)) // 01:59 EST
	app.RunAllocation(t)
	if got := runs(t, app); got != 0 {
		t.Fatalf("planned before the gap: %d runs", got)
	}
	app.Clock.Set(utc(8, 7, 0)) // 03:00 EDT, the first tick after the skipped time
	app.RunAllocation(t)
	app.Clock.Set(utc(8, 7, 15))
	app.RunAllocation(t)
	if got := runs(t, app); got != 1 {
		t.Fatalf("%d runs, want 1", got)
	}
}

func TestConcurrentPlansOfOneHomeMakeOneRun(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "a@example.com", "UTC", "07:00")
	app.Clock.Set(utc(4, 7, 0))

	var wg sync.WaitGroup
	for range 6 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := app.Planner.RunDue(context.Background(), app.Clock.Now()); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := runs(t, app); got != 1 {
		t.Fatalf("%d runs, want 1", got)
	}
}

func TestAHomeWithNoTasksStillRecordsAnEmptyRun(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "a@example.com", "UTC", "07:00")
	app.Clock.Set(utc(4, 7, 0))
	app.RunAllocation(t)

	var allocator, outcome string
	if err := app.DB.QueryRow(context.Background(),
		`SELECT allocator, outcome FROM allocation_runs`).Scan(&allocator, &outcome); err != nil {
		t.Fatal(err)
	}
	if allocator != "baseline" || outcome != "planned" {
		t.Fatalf("run = %s/%s, want baseline/planned", allocator, outcome)
	}
}

func TestABadTimezoneDoesNotStopTheOtherHomes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "bad@example.com", "UTC", "07:00")
	newHome(t, app, "good@example.com", "UTC", "07:00")
	if _, err := app.DB.Exec(context.Background(),
		`UPDATE homes SET timezone = 'Mars/Olympus' WHERE id = (SELECT home_id FROM residents ORDER BY created_at LIMIT 1)`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Set(utc(4, 7, 0))
	app.RunAllocation(t)
	if got := runs(t, app); got != 1 {
		t.Fatalf("%d runs, want the good Home planned", got)
	}
	if !app.Logs.Contains("Mars/Olympus") {
		t.Errorf("the bad timezone was not logged: %s", app.Logs.String())
	}
}
