package llmalloc

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

// FakeClient is a Client for tests: it answers a canned JSON, fails with a
// canned error, or blocks until the context ends, and records every call. It
// reports a canned Usage (by default the default model and a few hundred
// tokens). Safe for concurrent use.
type FakeClient struct {
	mu        sync.Mutex
	answer    json.RawMessage
	err       error
	block     bool
	usage     *Usage
	failUsage bool
	calls     []Request
}

// NewFakeClient returns a FakeClient that answers an empty plan and reports a
// small Usage of the default model.
func NewFakeClient() *FakeClient {
	return &FakeClient{
		answer: json.RawMessage(`{"assignments": [], "pool": []}`),
		usage:  &Usage{Model: config.DefaultLLMModel, InputTokens: 1000, OutputTokens: 200},
	}
}

// Answer makes every call return raw.
func (f *FakeClient) Answer(raw string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.answer, f.err, f.block, f.failUsage = json.RawMessage(raw), nil, false, false
}

// Fail makes every call return err, without usage: the API sent none.
func (f *FakeClient) Fail(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err, f.block, f.failUsage = err, false, false
}

// FailWithUsage makes every call return err together with the Usage, like a
// paid call whose answer is unusable.
func (f *FakeClient) FailWithUsage(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err, f.block, f.failUsage = err, false, true
}

// Block makes every call wait until its context ends, then return its error,
// with no usage: no response came back.
func (f *FakeClient) Block() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.block = true
}

// ReportUsage sets the Usage every response reports.
func (f *FakeClient) ReportUsage(model string, input, output int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.usage = &Usage{Model: model, InputTokens: input, OutputTokens: output}
}

// NoUsage makes every response report no Usage.
func (f *FakeClient) NoUsage() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.usage = nil
}

// Complete records the call, then answers as configured.
func (f *FakeClient) Complete(ctx context.Context, req Request) (json.RawMessage, *Usage, error) {
	f.mu.Lock()
	f.calls = append(f.calls, req)
	answer, err, block, usage, failUsage := f.answer, f.err, f.block, f.usage, f.failUsage
	f.mu.Unlock()
	if block {
		<-ctx.Done()
		return nil, nil, ctx.Err()
	}
	if err != nil && !failUsage {
		return answer, nil, err
	}
	if usage != nil {
		u := *usage
		usage = &u
	}
	return answer, usage, err
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
