package dayplan_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestLLMCapRefusesTheCallPastTheLimit(t *testing.T) {
	app := apitest.Start(t)
	home := homeIDOf(t, apitest.HomeWithResident(t, app, "a@example.com"))
	day := allocation.DateOf(apitest.StartTime)

	var got []bool
	for range 3 {
		ok, err := dayplan.ReserveLLMCall(context.Background(), app.DB, home, day, 2)
		if err != nil {
			t.Fatal(err)
		}
		got = append(got, ok)
	}
	if got[0] != true || got[1] != true || got[2] != false {
		t.Fatalf("reservations = %v, want [true true false]", got)
	}
}

func TestLLMCapCountsEachHomeAndDateApart(t *testing.T) {
	app := apitest.Start(t)
	homeA, homeB := homeIDOf(t, apitest.HomeWithResident(t, app, "a@example.com")), homeIDOf(t, apitest.HomeWithResident(t, app, "b@example.com"))
	day := allocation.DateOf(apitest.StartTime)
	ctx := context.Background()

	if ok, err := dayplan.ReserveLLMCall(ctx, app.DB, homeA, day, 1); err != nil || !ok {
		t.Fatalf("first call of home A: %v %v", ok, err)
	}
	if ok, err := dayplan.ReserveLLMCall(ctx, app.DB, homeB, day, 1); err != nil || !ok {
		t.Fatalf("home B has its own cap: %v %v", ok, err)
	}
	if ok, err := dayplan.ReserveLLMCall(ctx, app.DB, homeA, day+1, 1); err != nil || !ok {
		t.Fatalf("tomorrow has its own cap: %v %v", ok, err)
	}
}

func TestLLMCapHoldsUnderConcurrentReservations(t *testing.T) {
	app := apitest.Start(t)
	home := homeIDOf(t, apitest.HomeWithResident(t, app, "a@example.com"))
	day := allocation.DateOf(apitest.StartTime)

	var taken atomic.Int32
	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			ok, err := dayplan.ReserveLLMCall(context.Background(), app.DB, home, day, 3)
			if err != nil {
				t.Error(err)
			}
			if ok {
				taken.Add(1)
			}
		})
	}
	wg.Wait()
	if taken.Load() != 3 {
		t.Fatalf("taken = %d, want exactly the cap of 3", taken.Load())
	}
}
