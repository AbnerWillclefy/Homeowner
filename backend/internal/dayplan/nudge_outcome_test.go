package dayplan_test

import (
	"context"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// outcomeOf reads the outcome of the only nudge row of kind; "<null>" if null.
func outcomeOf(t *testing.T, app *apitest.App, kind string) string {
	t.Helper()
	var out *string
	if err := app.DB.QueryRow(context.Background(),
		`SELECT outcome FROM nudges WHERE kind = $1`, kind).Scan(&out); err != nil {
		t.Fatalf("read outcome of %s: %v", kind, err)
	}
	if out == nil {
		return "<null>"
	}
	return *out
}

// soloPlanned makes a one-Resident Home (07:00 local) with the given devices.
func soloPlanned(t *testing.T, devices ...string) *apitest.App {
	t.Helper()
	app := apitest.Start(t, apitest.WithPush("k"))
	a := newHome(t, app, "a@example.com", "America/Sao_Paulo", "07:00")
	for _, d := range devices {
		subscribe(t, a, d)
	}
	return app
}

func TestTheNudgeRecordsWhatThePushServiceAnswered(t *testing.T) {
	t.Parallel()

	t.Run("delivered", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a")
		app.Clock.Set(utc(4, 10, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, ready); got != "delivered" {
			t.Fatalf("outcome = %s", got)
		}
	})
	t.Run("failed", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a")
		app.Push.AnswerError(endpoint("a"))
		app.Clock.Set(utc(4, 10, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, ready); got != "failed" {
			t.Fatalf("outcome = %s", got)
		}
	})
	t.Run("gone", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a")
		app.Push.AnswerGone(endpoint("a"))
		app.Clock.Set(utc(4, 10, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, ready); got != "gone" {
			t.Fatalf("outcome = %s", got)
		}
		var n int
		if err := app.DB.QueryRow(context.Background(),
			`SELECT count(*) FROM push_subscriptions WHERE endpoint = $1`, endpoint("a")).Scan(&n); err != nil || n != 0 {
			t.Fatalf("subscription rows = %d, err = %v", n, err)
		}
	})
	t.Run("one device gone and one delivered is delivered", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a", "b")
		app.Push.AnswerGone(endpoint("a"))
		app.Clock.Set(utc(4, 10, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, ready); got != "delivered" {
			t.Fatalf("outcome = %s", got)
		}
	})
	t.Run("one device failed and one gone is failed", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a", "b")
		app.Push.AnswerGone(endpoint("a"))
		app.Push.AnswerError(endpoint("b"))
		app.Clock.Set(utc(4, 10, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, ready); got != "failed" {
			t.Fatalf("outcome = %s", got)
		}
	})
	t.Run("the check-in reminder is recorded too", func(t *testing.T) {
		t.Parallel()
		app := soloPlanned(t, "a")
		app.Clock.Set(utc(4, 9, 0))
		app.RunAllocation(t)
		if got := outcomeOf(t, app, reminder); got != "delivered" {
			t.Fatalf("outcome = %s", got)
		}
	})
}

func TestAFailedOutcomeUpdateIsLoggedAndTheResidentStillGetsThePush(t *testing.T) {
	t.Parallel()
	app := soloPlanned(t, "a")
	if _, err := app.DB.Exec(context.Background(), `
		CREATE FUNCTION refuse_update() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''no updates''; END';
		CREATE TRIGGER refuse BEFORE UPDATE ON nudges FOR EACH ROW EXECUTE FUNCTION refuse_update()`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Set(utc(4, 10, 0))
	app.RunAllocation(t)

	wantPushes(t, app, ready+":a")
	if !app.Logs.Contains("nudge: outcome update failed") {
		t.Fatalf("no warning logged: %s", app.Logs.String())
	}
	if got := outcomeOf(t, app, ready); got != "<null>" {
		t.Fatalf("outcome = %s", got)
	}
	if app.Logs.Contains(endpoint("a")) {
		t.Fatal("the endpoint was logged")
	}
}
