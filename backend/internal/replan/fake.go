package replan

import (
	"context"
	"sync"
)

// Fake is a Replanner for tests: it records the Home ids and can be told to
// fail. Safe for concurrent use.
type Fake struct {
	mu    sync.Mutex
	homes []string
	err   error
}

// NewFake returns a Fake that accepts every request.
func NewFake() *Fake { return &Fake{} }

// FailWith makes every later Replan return err.
func (f *Fake) FailWith(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err = err
}

// Replan records homeID, then answers as configured.
func (f *Fake) Replan(_ context.Context, homeID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.homes = append(f.homes, homeID)
	return f.err
}

// Homes returns a copy of every Home id asked for, in order.
func (f *Fake) Homes() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.homes...)
}
