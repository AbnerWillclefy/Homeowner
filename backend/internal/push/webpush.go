package push

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/SherClockHolmes/webpush-go"
)

const (
	sendTimeout = 10 * time.Second
	// A reminder that cannot be delivered within a day is stale.
	messageTTL = 24 * 60 * 60
)

// WebPushSender is the real Sender: standard Web Push with VAPID.
type WebPushSender struct {
	publicKey, privateKey, subject string
	client                         *http.Client
}

// NewWebPushSender returns a Sender signing with the VAPID key pair. subject
// is a mailto: or https: contact the push service can reach. webpush-go adds
// "mailto:" to anything not starting with "https:", so a leading mailto: is
// stripped here to avoid signing "mailto:mailto:...", which Apple rejects.
func NewWebPushSender(publicKey, privateKey, subject string) *WebPushSender {
	subject = strings.TrimSpace(subject)
	if len(subject) >= len("mailto:") && strings.EqualFold(subject[:len("mailto:")], "mailto:") {
		subject = subject[len("mailto:"):]
	}
	return &WebPushSender{
		publicKey:  publicKey,
		privateKey: privateKey,
		subject:    subject,
		client:     &http.Client{Timeout: sendTimeout},
	}
}

// Send encrypts payload for sub and posts it to the push service.
func (s *WebPushSender) Send(ctx context.Context, sub Subscription, payload Payload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode payload: %w", err)
	}
	res, err := webpush.SendNotificationWithContext(ctx, body, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
	}, &webpush.Options{
		HTTPClient:      s.client,
		Subscriber:      s.subject,
		VAPIDPublicKey:  s.publicKey,
		VAPIDPrivateKey: s.privateKey,
		TTL:             messageTTL,
		Urgency:         webpush.UrgencyNormal,
	})
	if err != nil {
		return fmt.Errorf("send web push: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4096))

	switch {
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
		return fmt.Errorf("push service answered %d: %w", res.StatusCode, ErrGone)
	case res.StatusCode < 200 || res.StatusCode > 299:
		return fmt.Errorf("push service answered %d", res.StatusCode)
	}
	return nil
}
