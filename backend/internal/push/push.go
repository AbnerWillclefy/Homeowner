// Package push sends Web Push messages (ADR 0005) behind a small interface so
// the API tests can fake the push service.
package push

import (
	"context"
	"errors"
)

// Subscription is a stored browser push subscription: where to send, and the
// keys that encrypt the payload.
type Subscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// Payload is the notification the service worker shows. Keep it tiny: push
// services reject bodies over about 4 KB.
type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

// ErrGone means the push service answered 404 or 410: the subscription no
// longer exists and must be dropped.
var ErrGone = errors.New("push subscription is gone")

// Sender delivers one payload to one subscription. It returns nil on success,
// an error wrapping ErrGone when the push service rejected the subscription,
// and any other error for transient or unexpected failures.
type Sender interface {
	Send(ctx context.Context, sub Subscription, payload Payload) error
}
