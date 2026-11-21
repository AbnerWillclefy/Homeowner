package push

import (
	"context"
	"encoding/base64"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxPushBody     = 8 * 1024
	maxUserAgentLen = 512
	// maxTestDelaySeconds plus the 10s send timeout stays inside the 25s Lambda timeout.
	maxTestDelaySeconds = 10
	testNotification    = "Reminders are on"
)

// Handler serves the /push routes. A nil sender or an empty public key means
// push is not configured.
type Handler struct {
	store     *Store
	sender    Sender
	publicKey string
	clock     clock.Clock
	log       *slog.Logger
	// allowsRevenue reports whether an email may hold a Revenue subscription
	// (the Finances allowlist).
	allowsRevenue func(email string) bool
}

// NewHandler returns a Handler over store that sends through sender. allowsRevenue
// gates Revenue subscriptions.
func NewHandler(store *Store, sender Sender, publicKey string, allowsRevenue func(email string) bool, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, sender: sender, publicKey: publicKey, allowsRevenue: allowsRevenue, clock: clk, log: log}
}

// RequireConfigured wraps a push handler so it answers 503 when push is not
// configured (no VAPID keys), instead of failing at startup.
func (h *Handler) RequireConfigured(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.sender == nil || h.publicKey == "" {
			httpx.WriteError(w, http.StatusServiceUnavailable, "push not configured")
			return
		}
		next(w, r)
	}
}

// PublicKey answers GET /push/vapid-public-key.
func (h *Handler) PublicKey(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"key": h.publicKey})
}

type subscriptionBody struct {
	Endpoint  string `json:"endpoint"`
	UserAgent string `json:"userAgent"`
	// App is the app the subscription was made in; empty means homeowner.
	App  string `json:"app"`
	Keys struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func validEndpoint(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.Host != ""
}

func validBase64URL(v string) bool {
	if v == "" {
		return false
	}
	_, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(v, "="))
	return err == nil
}

// PutSubscription answers PUT /push/subscription.
func (h *Handler) PutSubscription(w http.ResponseWriter, r *http.Request) {
	var body subscriptionBody
	if !httpx.DecodeBody(w, r, &body, maxPushBody, false) {
		return
	}
	switch {
	case !validEndpoint(body.Endpoint):
		httpx.WriteError(w, http.StatusBadRequest, "endpoint must be an https URL")
		return
	case !validBase64URL(body.Keys.P256dh) || !validBase64URL(body.Keys.Auth):
		httpx.WriteError(w, http.StatusBadRequest, "keys.p256dh and keys.auth must be base64url")
		return
	}
	app := body.App
	if app == "" {
		app = AppHomeowner
	}
	user := identity.CurrentUser(r.Context())
	switch {
	case app != AppHomeowner && app != AppRevenue:
		httpx.WriteError(w, http.StatusBadRequest, "app must be homeowner or revenue")
		return
	case app == AppRevenue && !h.allowsRevenue(user.Email):
		httpx.WriteError(w, http.StatusForbidden, "forbidden")
		return
	}
	ua := body.UserAgent
	if len(ua) > maxUserAgentLen {
		ua = ua[:maxUserAgentLen]
	}
	sub := Subscription{
		Endpoint: body.Endpoint,
		P256dh:   strings.TrimRight(body.Keys.P256dh, "="),
		Auth:     strings.TrimRight(body.Keys.Auth, "="),
	}
	if err := h.store.Upsert(r.Context(), user.ID, sub, app, ua, h.clock.Now()); err != nil {
		httpx.InternalError(w, h.log, "store push subscription", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteSubscription answers DELETE /push/subscription. It removes only the
// caller's row and answers 204 even when nothing matched.
func (h *Handler) DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if !httpx.DecodeBody(w, r, &body, maxPushBody, false) {
		return
	}
	if body.Endpoint == "" {
		httpx.WriteError(w, http.StatusBadRequest, "endpoint is required")
		return
	}
	if err := h.store.DeleteOwn(r.Context(), identity.CurrentUser(r.Context()).ID, body.Endpoint); err != nil {
		httpx.InternalError(w, h.log, "delete push subscription", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SendTest answers POST /push/test.
func (h *Handler) SendTest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint     string `json:"endpoint"`
		DelaySeconds int    `json:"delaySeconds"`
	}
	if !httpx.DecodeBody(w, r, &body, maxPushBody, false) {
		return
	}
	if body.Endpoint == "" {
		httpx.WriteError(w, http.StatusBadRequest, "endpoint is required")
		return
	}
	if body.DelaySeconds < 0 || body.DelaySeconds > maxTestDelaySeconds {
		httpx.WriteError(w, http.StatusBadRequest, "delaySeconds must be an integer from 0 to 10")
		return
	}
	// The client may close the app and drop the request; the wait and the
	// send must survive that.
	ctx := context.WithoutCancel(r.Context())
	sub, err := h.store.Get(ctx, identity.CurrentUser(ctx).ID, body.Endpoint)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "subscription not found")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "load push subscription", err)
		return
	}
	if body.DelaySeconds > 0 {
		if err := h.clock.Sleep(ctx, time.Duration(body.DelaySeconds)*time.Second); err != nil {
			httpx.InternalError(w, h.log, "wait before test notification", err)
			return
		}
	}
	err = h.store.Deliver(ctx, h.sender, sub, Payload{
		Title: testNotification,
		Body:  "This is a test notification from Homeowner.",
		URL:   "/",
	})
	switch {
	case err == nil:
		w.WriteHeader(http.StatusNoContent)
	case errors.Is(err, ErrGone):
		httpx.WriteError(w, http.StatusGone, "subscription is gone and was removed")
	default:
		h.log.Error("send test notification", "error", err.Error())
		httpx.WriteError(w, http.StatusBadGateway, "push service error")
	}
}
