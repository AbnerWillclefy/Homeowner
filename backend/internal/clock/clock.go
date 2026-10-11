// Package clock is the only place the current time may be read.
//
// Business code must never call time.Now(); it takes a Clock instead, so tests
// can set the time with Fake.
package clock

import (
	"context"
	"sync"
	"time"
)

// Clock tells the current time and waits.
type Clock interface {
	Now() time.Time
	// Sleep waits for d, or until ctx is done, and returns ctx's error then.
	Sleep(ctx context.Context, d time.Duration) error
}

// System is the real clock.
type System struct{}

// Now returns the current wall-clock time.
func (System) Now() time.Time { return time.Now() }

// Sleep waits for d or until ctx is done.
func (System) Sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Fake is a Clock whose time is set by tests. Safe for concurrent use.
type Fake struct {
	mu    sync.Mutex
	now   time.Time
	slept []time.Duration
}

// Sleep returns immediately and records d, so tests can assert what was waited.
func (f *Fake) Sleep(_ context.Context, d time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.slept = append(f.slept, d)
	return nil
}

// Slept returns the durations passed to Sleep, in order.
func (f *Fake) Slept() []time.Duration {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]time.Duration(nil), f.slept...)
}

// NewFake returns a Fake reading t.
func NewFake(t time.Time) *Fake { return &Fake{now: t} }

// Now returns the fake time.
func (f *Fake) Now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.now
}

// Set moves the fake time to t.
func (f *Fake) Set(t time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.now = t
}

// Advance moves the fake time forward by d.
func (f *Fake) Advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.now = f.now.Add(d)
}
