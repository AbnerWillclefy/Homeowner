package llmalloc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
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

// ScriptedClient plays a Converse conversation for tests: a queue of steps
// (a tool round, an answer, a failure, a block), each call popping the next.
// It records a deep copy of every Conversation it received and reports a
// canned Usage of the default model. Safe for concurrent use.
type ScriptedClient struct {
	mu     sync.Mutex
	steps  []scriptStep
	calls  []Conversation
	nextID int
}

type scriptStep struct {
	uses      []ToolUse
	text      string
	err       error
	failUsage bool
	block     bool
}

// NewScriptedClient returns a ScriptedClient with an empty script.
func NewScriptedClient() *ScriptedClient { return &ScriptedClient{} }

func (s *ScriptedClient) add(step scriptStep) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.steps = append(s.steps, step)
}

// ToolRound queues a reply asking for uses. Their IDs are assigned when played
// (toolu_1, toolu_2, ...), so the test names only the tool and its input.
func (s *ScriptedClient) ToolRound(uses ...ToolUse) { s.add(scriptStep{uses: uses}) }

// Answer queues a final text reply.
func (s *ScriptedClient) Answer(text string) { s.add(scriptStep{text: text}) }

// Fail queues an error without usage: the API sent no response.
func (s *ScriptedClient) Fail(err error) { s.add(scriptStep{err: err}) }

// FailWithUsage queues an error with the Usage, like a paid call whose answer is unusable.
func (s *ScriptedClient) FailWithUsage(err error) { s.add(scriptStep{err: err, failUsage: true}) }

// Block queues a call that waits until its context ends, with no usage.
func (s *ScriptedClient) Block() { s.add(scriptStep{block: true}) }

// Converse records conv, then plays the next step. Past the end of the script
// it fails: it never repeats the last step.
func (s *ScriptedClient) Converse(ctx context.Context, conv Conversation) (Turn, *Usage, error) {
	s.mu.Lock()
	s.calls = append(s.calls, copyConversation(conv))
	if len(s.steps) == 0 {
		n := len(s.calls)
		s.mu.Unlock()
		return Turn{}, nil, fmt.Errorf("llmalloc: ScriptedClient has no step for call %d", n)
	}
	step := s.steps[0]
	s.steps = s.steps[1:]
	var uses []ToolUse
	for _, u := range step.uses {
		s.nextID++
		u.ID = fmt.Sprintf("toolu_%d", s.nextID)
		uses = append(uses, u)
	}
	s.mu.Unlock()
	usage := &Usage{Model: config.DefaultLLMModel, InputTokens: 1000, OutputTokens: 200}
	switch {
	case step.block:
		<-ctx.Done()
		return Turn{}, nil, ctx.Err()
	case step.err != nil && step.failUsage:
		return Turn{}, usage, step.err
	case step.err != nil:
		return Turn{}, nil, step.err
	case len(uses) == 0 && step.text == "":
		return Turn{}, nil, errors.New("llmalloc: ScriptedClient step is empty")
	}
	return Turn{ToolUses: uses, Text: step.text}, usage, nil
}

// Calls returns how many calls were made, the failed past-the-script ones too.
func (s *ScriptedClient) Calls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

// Requests returns a deep copy of every Conversation received, in order.
// shortcut: Tool input schemas are shared, not copied; no test edits them.
func (s *ScriptedClient) Requests() []Conversation {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Conversation, len(s.calls))
	for i, c := range s.calls {
		out[i] = copyConversation(c)
	}
	return out
}

func copyConversation(c Conversation) Conversation {
	c.Tools = slices.Clone(c.Tools)
	msgs := make([]Message, len(c.Messages))
	for i, m := range c.Messages {
		m.ToolResults = slices.Clone(m.ToolResults)
		uses := slices.Clone(m.ToolUses)
		for j := range uses {
			uses[j].Input = slices.Clone(uses[j].Input)
		}
		m.ToolUses = uses
		msgs[i] = m
	}
	c.Messages = msgs
	return c
}
