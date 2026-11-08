package voice_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/voice"
)

// userWith signs email in and seeds calls voice calls on day for them.
func userWith(t *testing.T, app *apitest.App, email string, day allocation.Date, calls int) string {
	t.Helper()
	app.SignInAs(email).Get("/home")
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM users WHERE email = $1`, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if calls > 0 {
		if _, err := app.DB.Exec(context.Background(),
			`INSERT INTO voice_calls (user_id, call_date, calls) VALUES ($1, $2, $3)`, id, day.Time(), calls); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

func TestReserveCallTakesTheTwentiethAndRefusesTheNext(t *testing.T) {
	app := apitest.Start(t)
	day := allocation.DateOf(apitest.StartTime)
	id := userWith(t, app, "a@example.com", day, 19)

	calls, ok, err := voice.ReserveCall(context.Background(), app.DB, id, day, voice.DailyLimit)
	if err != nil || !ok || calls != 20 {
		t.Fatalf("19 calls: got %d %v %v, want 20 true", calls, ok, err)
	}
	calls, ok, err = voice.ReserveCall(context.Background(), app.DB, id, day, voice.DailyLimit)
	if err != nil || ok || calls != 0 {
		t.Fatalf("20 calls: got %d %v %v, want refused", calls, ok, err)
	}
	var stored int
	if err := app.DB.QueryRow(context.Background(), `SELECT calls FROM voice_calls WHERE user_id = $1`, id).Scan(&stored); err != nil || stored != 20 {
		t.Fatalf("stored = %d %v, want 20", stored, err)
	}
}

func TestReserveCallHoldsUnderConcurrentReservations(t *testing.T) {
	app := apitest.Start(t)
	day := allocation.DateOf(apitest.StartTime)
	id := userWith(t, app, "a@example.com", day, 19)

	var taken atomic.Int32
	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			_, ok, err := voice.ReserveCall(context.Background(), app.DB, id, day, voice.DailyLimit)
			if err != nil {
				t.Error(err)
			}
			if ok {
				taken.Add(1)
			}
		})
	}
	wg.Wait()
	if taken.Load() != 1 {
		t.Fatalf("taken = %d, want exactly 1", taken.Load())
	}
}

func TestReserveCallCountsEachUserAndDateApart(t *testing.T) {
	app := apitest.Start(t)
	day := allocation.DateOf(apitest.StartTime)
	a := userWith(t, app, "a@example.com", day, 20)
	b := userWith(t, app, "b@example.com", day, 0)
	ctx := context.Background()

	if calls, ok, err := voice.ReserveCall(ctx, app.DB, b, day, voice.DailyLimit); err != nil || !ok || calls != 1 {
		t.Fatalf("other User: %d %v %v, want 1 true", calls, ok, err)
	}
	if calls, ok, err := voice.ReserveCall(ctx, app.DB, a, day+1, voice.DailyLimit); err != nil || !ok || calls != 1 {
		t.Fatalf("next day: %d %v %v, want 1 true", calls, ok, err)
	}
}

func TestEveryServiceCanWriteAnEventAndAnUnknownOneCannot(t *testing.T) {
	app := apitest.Start(t)
	for _, s := range []string{"allocator", "explainer", "categorizer", "voice"} {
		if _, err := app.DB.Exec(context.Background(), `
			INSERT INTO llm_call_events (created_at, local_date, service, model, outcome)
			VALUES (now(), '2026-03-04', $1, 'm', 'accepted')`, s); err != nil {
			t.Errorf("service %q: %v", s, err)
		}
	}
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO llm_call_events (created_at, local_date, service, model, outcome)
		VALUES (now(), '2026-03-04', 'nope', 'm', 'accepted')`); err == nil {
		t.Error("unknown service accepted")
	}
}
