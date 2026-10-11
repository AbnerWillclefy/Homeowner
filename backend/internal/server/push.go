package server

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

const (
	maxPushBody      = 8 * 1024
	maxUserAgentLen  = 512
	testNotification = "Reminders are on"
)

// requirePush wraps a push handler so it answers 503 when push is not
// configured (no VAPID keys), instead of failing at startup.
func (s *server) requirePush(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.deps.Push == nil || s.deps.VAPIDPublicKey == "" {
			writeError(w, http.StatusServiceUnavailable, "push not configured")
			return
		}
		next(w, r)
	}
}

// decodeBody reads a size-capped JSON body into v and writes the error
// response itself when it fails.
func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxPushBody)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func (s *server) vapidPublicKey(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"key": s.deps.VAPIDPublicKey})
}

type subscriptionBody struct {
	Endpoint  string `json:"endpoint"`
	UserAgent string `json:"userAgent"`
	Keys      struct {
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

func (s *server) putPushSubscription(w http.ResponseWriter, r *http.Request) {
	var body subscriptionBody
	if !decodeBody(w, r, &body) {
		return
	}
	switch {
	case !validEndpoint(body.Endpoint):
		writeError(w, http.StatusBadRequest, "endpoint must be an https URL")
		return
	case !validBase64URL(body.Keys.P256dh) || !validBase64URL(body.Keys.Auth):
		writeError(w, http.StatusBadRequest, "keys.p256dh and keys.auth must be base64url")
		return
	}
	ua := body.UserAgent
	if len(ua) > maxUserAgentLen {
		ua = ua[:maxUserAgentLen]
	}
	sub := push.Subscription{
		Endpoint: body.Endpoint,
		P256dh:   strings.TrimRight(body.Keys.P256dh, "="),
		Auth:     strings.TrimRight(body.Keys.Auth, "="),
	}
	if err := s.push.Upsert(r.Context(), sub, ua, s.deps.Clock.Now()); err != nil {
		s.deps.Logger.Error("store push subscription", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) postPushTest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Endpoint == "" {
		writeError(w, http.StatusBadRequest, "endpoint is required")
		return
	}
	sub, err := s.push.Get(r.Context(), body.Endpoint)
	if errors.Is(err, push.ErrNotFound) {
		writeError(w, http.StatusNotFound, "subscription not found")
		return
	}
	if err != nil {
		s.deps.Logger.Error("load push subscription", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	err = s.push.Deliver(r.Context(), s.deps.Push, sub, push.Payload{
		Title: testNotification,
		Body:  "This is a test notification from Homeowner.",
		URL:   "/",
	})
	switch {
	case err == nil:
		w.WriteHeader(http.StatusNoContent)
	case errors.Is(err, push.ErrGone):
		writeError(w, http.StatusGone, "subscription is gone and was removed")
	default:
		s.deps.Logger.Error("send test notification", "error", err.Error())
		writeError(w, http.StatusBadGateway, "push service error")
	}
}
