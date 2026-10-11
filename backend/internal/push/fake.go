package push

import (
	"context"
	"errors"
	"sync"
)

// Sent is one send the Fake recorded.
type Sent struct {
	Subscription Subscription
	Payload      Payload
}

// Fake is a Sender for tests: it records every send and can be told to answer
// "gone" or "error" for an endpoint. Safe for concurrent use.
type Fake struct {
	mu   sync.Mutex
	sent []Sent
	gone map[string]bool
	fail map[string]bool
}

// NewFake returns a Fake that accepts every send.
func NewFake() *Fake {
	return &Fake{gone: map[string]bool{}, fail: map[string]bool{}}
}

// AnswerGone makes sends to endpoint fail as if the push service said 410.
func (f *Fake) AnswerGone(endpoint string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.gone[endpoint] = true
}

// AnswerError makes sends to endpoint fail with a generic error.
func (f *Fake) AnswerError(endpoint string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.fail[endpoint] = true
}

// Send records the send, then answers as configured.
func (f *Fake) Send(_ context.Context, sub Subscription, p Payload) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, Sent{Subscription: sub, Payload: p})
	if f.gone[sub.Endpoint] {
		return ErrGone
	}
	if f.fail[sub.Endpoint] {
		return errors.New("fake push service error")
	}
	return nil
}

// Sent returns a copy of every recorded send, in order.
func (f *Fake) Sent() []Sent {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]Sent(nil), f.sent...)
}
