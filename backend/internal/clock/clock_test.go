package clock_test

import (
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
)

func TestFakeNowReturnsStartTime(t *testing.T) {
	start := time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)
	f := clock.NewFake(start)
	if got := f.Now(); !got.Equal(start) {
		t.Fatalf("Now() = %v, want %v", got, start)
	}
}

func TestFakeSetChangesNow(t *testing.T) {
	f := clock.NewFake(time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC))
	next := time.Date(2027, 1, 2, 3, 4, 5, 0, time.UTC)
	f.Set(next)
	if got := f.Now(); !got.Equal(next) {
		t.Fatalf("Now() = %v, want %v", got, next)
	}
}

func TestFakeAdvanceMovesForward(t *testing.T) {
	start := time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)
	f := clock.NewFake(start)
	f.Advance(36 * time.Hour)
	if got, want := f.Now(), start.Add(36*time.Hour); !got.Equal(want) {
		t.Fatalf("Now() = %v, want %v", got, want)
	}
}

func TestFakeIsSafeForConcurrentUse(t *testing.T) {
	f := clock.NewFake(time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC))
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(3)
		go func() { defer wg.Done(); f.Advance(time.Second) }()
		go func() { defer wg.Done(); _ = f.Now() }()
		go func() { defer wg.Done(); f.Set(f.Now()) }()
	}
	wg.Wait()
}

func TestSystemImplementsClock(t *testing.T) {
	var c clock.Clock = clock.System{}
	if c.Now().IsZero() {
		t.Fatal("System.Now() returned zero time")
	}
}
