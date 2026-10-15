package llmalloc

import (
	"context"
	"encoding/json"
	"sync"
)

// FakeClient is a Client for tests: it answers a canned JSON, fails with a
// canned error, or blocks until the context ends, and records every call.
// Safe for concurrent use.
type FakeClient struct {
	mu     sync.Mutex
	answer json.RawMessage
	err    error
	block  bool
	calls  []Request
}

// NewFakeClient returns a FakeClient that answers an empty plan.
func NewFakeClient() *FakeClient {
	return &FakeClient{answer: json.RawMessage(`{"assignments": [], "pool": []}`)}
}

// Answer makes every call return raw.
func (f *FakeClient) Answer(raw string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.answer, f.err, f.block = json.RawMessage(raw), nil, false
}

// Fail makes every call return err.
func (f *FakeClient) Fail(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err, f.block = err, false
}

// Block makes every call wait until its context ends, then return its error.
func (f *FakeClient) Block() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.block = true
}

// Complete records the call, then answers as configured.
func (f *FakeClient) Complete(ctx context.Context, req Request) (json.RawMessage, error) {
	f.mu.Lock()
	f.calls = append(f.calls, req)
	answer, err, block := f.answer, f.err, f.block
	f.mu.Unlock()
	if block {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return answer, err
}

// Calls returns how many calls were made.
func (f *FakeClient) Calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

// LastRequest returns the most recent call's Request.
func (f *FakeClient) LastRequest() Request {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[len(f.calls)-1]
}
