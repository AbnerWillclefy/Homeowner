package dayplan_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// Valid base64url key material, as PushSubscription.toJSON() emits.
const (
	testP256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
	testAuth   = "tBHItJI5svbpez7KI4CCXg"
)

const (
	reminder = "checkin_reminder"
	ready    = "day_plan_ready"
)

func endpoint(name string) string { return "https://push.example.com/send/" + name }

// subscribe registers a device for the signed-in User.
func subscribe(t *testing.T, c *apitest.Client, name string) {
	t.Helper()
	r := c.Put("/push/subscription", map[string]any{
		"endpoint": endpoint(name),
		"keys":     map[string]string{"p256dh": testP256dh, "auth": testAuth},
	})
	if r.Status >= 300 {
		t.Fatalf("PUT /push/subscription = %d %s", r.Status, r.Raw)
	}
}

// second makes email a Resident of the Home of first.
func second(t *testing.T, app *apitest.App, first *apitest.Client, email string) *apitest.Client {
	t.Helper()
	b := app.SignInAs(email)
	b.JoinHome(t, first.Get("/home").Body["id"].(string))
	return b
}

// pushes lists "kind:device" for every send so far, sorted.
func pushes(app *apitest.App) []string {
	var out []string
	for _, s := range app.Push.Sent() {
		out = append(out, s.Payload.Kind+":"+s.Subscription.Endpoint[len(endpoint("")):])
	}
	slices.Sort(out)
	return out
}

func wantPushes(t *testing.T, app *apitest.App, want ...string) {
	t.Helper()
	slices.Sort(want)
	if got := pushes(app); !slices.Equal(got, want) {
		t.Fatalf("pushes = %v, want %v", got, want)
	}
}

// pair is a Sao Paulo Home (07:00, UTC-3) with Residents a and b, one device each.
func pair(t *testing.T, app *apitest.App) (a, b *apitest.Client) {
	t.Helper()
	a = newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	b = second(t, app, a, "b@example.com")
	subscribe(t, a, "a")
	subscribe(t, b, "b")
	return a, b
}

func TestTheReminderGoesOnlyToResidentsWithoutACheckInAnHourBefore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a, _ := pair(t, app)
	app.Clock.Set(utc(4, 8, 30)) // 05:30 local, so the Check-in is for the 4th
	checkIn(t, a, "normal")

	app.Clock.Set(utc(4, 8, 59)) // 05:59 local
	app.RunAllocation(t)
	wantPushes(t, app)

	app.Clock.Set(utc(4, 9, 0)) // 06:00 local
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":b")
	if s := app.Push.Sent()[0]; s.Payload.Title == "" || s.Payload.Body == "" || s.Payload.URL != "/" {
		t.Fatalf("payload = %+v, want English text and url /", s.Payload)
	}
}

func TestFurtherTicksInTheWindowSendNothingMore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	_, b := pair(t, app)

	for _, at := range []int{0, 15, 30, 45} {
		app.Clock.Set(utc(4, 9, at))
		app.RunAllocation(t)
	}
	wantPushes(t, app, reminder+":a", reminder+":b")

	// Checking in after the reminder stops anything further, and a late
	// checker gets no second reminder.
	checkIn(t, b, "normal")
	app.Clock.Set(utc(4, 9, 50))
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":a", reminder+":b")
}

func TestNoReminderOnceTheAllocationTimeIsReached(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")

	app.Clock.Set(utc(4, 10, 0)) // 07:00 local
	sum := app.RunAllocation(t)
	if sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	wantPushes(t, app) // no subscribers here, and the window is closed
}

func TestAPlannedHomeGetsNoReminderInsideTheWindow(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	pair(t, app)
	// The Home is planned today (an on-demand plan, say) before the window.
	app.Clock.Set(utc(4, 8, 0))
	if _, err := app.Planner.PlanHome(context.Background(), homeID(t, app), app.Clock.Now()); err != nil {
		t.Fatal(err)
	}

	app.Clock.Set(utc(4, 9, 15))
	app.RunAllocation(t)
	wantPushes(t, app)
}

func homeID(t *testing.T, app *apitest.App) string {
	t.Helper()
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM homes`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestALateFirstTickStillRemindsBeforeAllocationButNotAfter(t *testing.T) {
	t.Parallel()
	t.Run("06:40 reminds", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t, apitest.WithPush("k"))
		pair(t, app)
		app.Clock.Set(utc(4, 9, 40))
		app.RunAllocation(t)
		wantPushes(t, app, reminder+":a", reminder+":b")
	})
	t.Run("07:05 plans and does not remind", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t, apitest.WithPush("k"))
		pair(t, app)
		app.Clock.Set(utc(4, 10, 5))
		if sum := app.RunAllocation(t); sum.Planned != 1 {
			t.Fatalf("summary = %+v", sum)
		}
		for _, p := range pushes(app) {
			if strings.HasPrefix(p, reminder) {
				t.Fatalf("reminded after the Allocation time: %v", pushes(app))
			}
		}
	})
}

func TestAHomeWhoseCheckInsCannotBeReadDoesNotCostAnotherItsReminder(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	bad := newHome(t, app, "bad@example.com", "America/Sao_Paulo", "07:00")
	good := newHome(t, app, "good@example.com", "America/Sao_Paulo", "07:00")
	subscribe(t, bad, "bad")
	subscribe(t, good, "good")

	// A Check-in row the store cannot read (a NULL level) for the bad Home only.
	ctx := context.Background()
	for _, q := range []string{
		`ALTER TABLE checkins DROP CONSTRAINT checkins_level_check`,
		`ALTER TABLE checkins ALTER COLUMN level DROP NOT NULL`,
	} {
		if _, err := app.DB.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO checkins (resident_id, checkin_date, level, created_at, updated_at)
		SELECT id, DATE '2026-03-04', NULL, now(), now() FROM residents WHERE home_id = $1`,
		bad.Get("/home").Body["id"].(string)); err != nil {
		t.Fatal(err)
	}

	app.Clock.Set(utc(4, 9, 0))
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":good")
}

func TestEachHomeIsRemindedAtItsOwnLocalHour(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	// 06:00 in Sao Paulo (UTC-3) is 09:00 UTC. Auckland (NZDT, UTC+13) is then
	// at 22:00 on the 4th, past its 07:00 Allocation, and reaches 06:00 on the
	// 5th at 17:00 UTC.
	sp := newHome(t, app, "sp@example.com", "America/Sao_Paulo", "07:00")
	nz := newHome(t, app, "nz@example.com", "Pacific/Auckland", "07:00")
	subscribe(t, sp, "sp")
	subscribe(t, nz, "nz")

	app.Clock.Set(utc(4, 9, 0))
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":sp", ready+":nz")

	app.Clock.Set(utc(4, 17, 0)) // 06:00 on the 5th in Auckland
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":sp", ready+":nz", ready+":sp", reminder+":nz")
}

func TestYesterdaysCheckInDoesNotCountAsToday(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a := newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	subscribe(t, a, "a")
	app.Clock.Set(utc(3, 15, 0)) // the 3rd, local
	checkIn(t, a, "normal")

	app.Clock.Set(utc(4, 9, 0))
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":a")
}

func TestAnAllocationTimeBeforeOneAmIsRemindedFromMidnight(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a := newHome(t, app, "a@example.com", "UTC", "00:30")
	subscribe(t, a, "a")

	app.Clock.Set(utc(5, 0, 0))
	app.RunAllocation(t)
	wantPushes(t, app, reminder+":a")
}

func TestEveryResidentGetsDayPlanReadyOncePerDevice(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a, b := pair(t, app)
	subscribe(t, a, "a-tablet")
	checkIn(t, b, "normal") // checked in or not, both are told

	app.Clock.Set(utc(4, 10, 0))
	app.RunAllocation(t)
	wantPushes(t, app, ready+":a", ready+":a-tablet", ready+":b")

	app.Clock.Set(utc(4, 10, 15))
	app.RunAllocation(t)
	if len(app.Push.Sent()) != 3 {
		t.Fatalf("a second tick sent more: %v", pushes(app))
	}
}

func TestDayPlanReadyComesBeforeRemindersInATick(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	newHome(t, app, "late@example.com", "America/Sao_Paulo", "07:00") // plans at 10:00 UTC
	soon := newHome(t, app, "soon@example.com", "UTC", "10:30")       // reminder window at 10:00 UTC
	subscribe(t, soon, "soon")
	due := app.SignInAs("late@example.com")
	subscribe(t, due, "late")

	app.Clock.Set(utc(4, 10, 0))
	app.RunAllocation(t)
	sent := app.Push.Sent()
	if len(sent) != 2 || sent[0].Payload.Kind != ready || sent[1].Payload.Kind != reminder {
		t.Fatalf("order = %v, want day_plan_ready then checkin_reminder", pushes(app))
	}
}

func TestARejectedRunSendsNoDayPlanReady(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a := newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	subscribe(t, a, "a")
	app.Clock.Set(utc(4, 9, 0))
	if r := a.Post("/home/chores", map[string]any{
		"name": "Dishes", "category": "kitchen", "demands": []string{}, "baseEffort": 2, "importance": "normal",
		"people": 1, "intervalDays": 7, "allowedWeekdays": []int{}, "buildsUp": false,
	}); r.Status != http.StatusCreated {
		t.Fatalf("POST /home/chores = %d %s", r.Status, r.Raw)
	}
	app.UseAllocator(overEnergy{})

	app.Clock.Set(utc(4, 10, 0))
	if sum := app.RunAllocation(t); sum.Rejected != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	for _, p := range pushes(app) {
		if strings.HasPrefix(p, ready) {
			t.Fatalf("a rejected day sent %v", pushes(app))
		}
	}
}

func TestAFailingPushNeverChangesAllocation(t *testing.T) {
	t.Parallel()
	// tick plans the pair's Home at 07:00 local after mutate, and checks the
	// plan is stored whatever the push did.
	tick := func(t *testing.T, mutate func(*apitest.App)) *apitest.App {
		app := apitest.Start(t, apitest.WithPush("k"))
		pair(t, app)
		mutate(app)
		app.Clock.Set(utc(4, 10, 0))
		sum := app.RunAllocation(t)
		if sum.Planned != 1 || sum.Failed != 0 || runs(t, app) != 1 {
			t.Fatalf("summary = %+v, runs = %d", sum, runs(t, app))
		}
		return app
	}
	run := func(t *testing.T, mutate func(*apitest.App)) []string {
		return pushes(tick(t, mutate))
	}

	t.Run("error is not retried next tick", func(t *testing.T) {
		t.Parallel()
		app := tick(t, func(app *apitest.App) { app.Push.AnswerError(endpoint("a")) })
		wantPushes(t, app, ready+":a", ready+":b")
		app.Clock.Set(utc(4, 10, 15))
		app.RunAllocation(t)
		if len(app.Push.Sent()) != 2 {
			t.Fatalf("retried: %v", pushes(app))
		}
	})
	t.Run("gone subscription is deleted", func(t *testing.T) {
		t.Parallel()
		got := run(t, func(app *apitest.App) { app.Push.AnswerGone(endpoint("a")) })
		if !slices.Contains(got, ready+":b") {
			t.Fatalf("the other Resident was not told: %v", got)
		}
	})
	t.Run("a failing ledger leaves the plan stored", func(t *testing.T) {
		t.Parallel()
		run(t, func(app *apitest.App) {
			if _, err := app.DB.Exec(context.Background(), `DROP TABLE nudges`); err != nil {
				t.Fatal(err)
			}
		})
	})
	t.Run("a failing subscription lookup leaves the plan stored", func(t *testing.T) {
		t.Parallel()
		run(t, func(app *apitest.App) {
			if _, err := app.DB.Exec(context.Background(), `ALTER TABLE push_subscriptions RENAME TO gone_subs`); err != nil {
				t.Fatal(err)
			}
		})
	})
}

// stubNudger is a Nudger whose calls run the given funcs.
type stubNudger struct {
	ready, reminders    func(ctx context.Context)
	readyRan, remindRan atomic.Bool
}

func (s *stubNudger) DayPlanReady(ctx context.Context, _ []string, _ time.Time) {
	s.readyRan.Store(true)
	if s.ready != nil {
		s.ready(ctx)
	}
}

func (s *stubNudger) CheckinReminders(ctx context.Context, _ time.Time) {
	s.remindRan.Store(true)
	if s.reminders != nil {
		s.reminders(ctx)
	}
}

// tickWith plans the pair's Home at 07:00 local with a Planner that nudges
// through n under timeout, and returns the Summary and how long RunDue took.
func tickWith(t *testing.T, n dayplan.Nudger, timeout time.Duration) (dayplan.Summary, time.Duration, *apitest.App) {
	t.Helper()
	app := apitest.Start(t, apitest.WithPush("k"))
	pair(t, app)
	planner := dayplan.New(app.DB, allocation.Baseline{}, slog.New(slog.NewJSONHandler(io.Discard, nil)),
		dayplan.WithNudger(n), dayplan.WithNudgeTimeout(timeout))
	start := time.Now()
	sum, err := planner.RunDue(context.Background(), utc(4, 10, 0))
	if err != nil {
		t.Fatalf("RunDue: %v", err)
	}
	return sum, time.Since(start), app
}

func TestAPanickingNudgerNeverChangesAllocation(t *testing.T) {
	t.Parallel()
	n := &stubNudger{ready: func(context.Context) { panic("push exploded") }}
	sum, _, app := tickWith(t, n, time.Minute)
	if sum.Planned != 1 || sum.Failed != 0 || runs(t, app) != 1 {
		t.Fatalf("summary = %+v, runs = %d", sum, runs(t, app))
	}
	if !n.readyRan.Load() {
		t.Fatal("DayPlanReady was not called")
	}
	// One recover covers both calls, so a panic in the first skips the second.
	if n.remindRan.Load() {
		t.Fatal("CheckinReminders ran after DayPlanReady panicked")
	}
}

func TestOneDeadlineBoundsAllTheNudging(t *testing.T) {
	t.Parallel()
	block := func(ctx context.Context) { <-ctx.Done() }
	n := &stubNudger{ready: block, reminders: block}
	const deadline = 300 * time.Millisecond
	sum, took, app := tickWith(t, n, deadline)
	if sum.Planned != 1 || sum.Failed != 0 || runs(t, app) != 1 {
		t.Fatalf("summary = %+v, runs = %d", sum, runs(t, app))
	}
	// The planning itself is quick; two per-call deadlines would take 2x.
	if took >= 2*deadline {
		t.Fatalf("RunDue took %v, want under %v: the deadline is not shared", took, 2*deadline)
	}
	if !n.remindRan.Load() {
		t.Fatal("CheckinReminders was not called")
	}
}

func TestAGoneSubscriptionIsRemovedFromTheStore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	pair(t, app)
	app.Push.AnswerGone(endpoint("a"))

	app.Clock.Set(utc(4, 10, 0))
	app.RunAllocation(t)

	var n int
	if err := app.DB.QueryRow(context.Background(),
		`SELECT count(*) FROM push_subscriptions WHERE endpoint = $1`, endpoint("a")).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("the gone subscription is still stored")
	}
}

func TestResidentsWithoutDevicesDoNotBreakTheTick(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	a := newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	second(t, app, a, "b@example.com") // nobody subscribed

	app.Clock.Set(utc(4, 9, 0))
	app.RunAllocation(t)
	app.Clock.Set(utc(4, 10, 0))
	if sum := app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
	wantPushes(t, app)
}

func TestWithoutPushTheTickStillPlans(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	app.Clock.Set(utc(4, 9, 0))
	app.RunAllocation(t)
	app.Clock.Set(utc(4, 10, 0))
	if sum := app.RunAllocation(t); sum.Planned != 1 {
		t.Fatalf("summary = %+v", sum)
	}
}
