package voice

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBody        = 4 << 10
	maxTranscript  = 500
	maxModelTokens = 1024
)

// callTimeout bounds one model call. shortcut: fixed 10s voice deadline, move
// to config if staging shows it is wrong.
var callTimeout = 10 * time.Second

// Handler serves POST /home/voice/interpret.
type Handler struct {
	client llmalloc.Client
	store  *Store
	model  string
	clock  clock.Clock
	log    *slog.Logger
}

// NewHandler returns a Handler. A nil client means voice is off. model is
// what an event row records when the call reported no Usage.
func NewHandler(client llmalloc.Client, store *Store, model string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{client: client, store: store, model: model, clock: clk, log: log}
}

// RequireConfigured wraps a handler so it answers 503 when voice is off.
func (h *Handler) RequireConfigured(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.client == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "voice not configured")
			return
		}
		next(w, r)
	}
}

// validTranscript reports whether s, trimmed, may be sent to the model.
func validTranscript(s string) bool {
	n := utf8.RuneCountInString(s)
	return n > 0 && n <= maxTranscript && !strings.ContainsFunc(s, unicode.IsControl)
}

// Interpret answers POST /home/voice/interpret. It never writes a Chore and
// never logs or stores the transcript.
func (h *Handler) Interpret(w http.ResponseWriter, r *http.Request) {
	var body interpretRequest
	if !httpx.DecodeBody(w, r, &body, maxBody, true) {
		return
	}
	transcript := strings.TrimSpace(body.Transcript)
	if !validTranscript(transcript) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_transcript")
		return
	}
	if body.Locale != "pt-BR" && body.Locale != "en-US" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_locale")
		return
	}

	ctx := r.Context()
	home := identity.CurrentMembership(ctx).Home
	loc, err := time.LoadLocation(home.Timezone)
	if err != nil {
		httpx.InternalError(w, h.log, "voice home timezone", err)
		return
	}
	stored, err := chores.ListIn(ctx, h.store.db, home.ID)
	if err != nil {
		httpx.InternalError(w, h.log, "voice chores", err)
		return
	}

	// Reserved after the reads and right before the call: a failed read costs
	// nothing, a failed call costs one.
	now := h.clock.Now()
	day := allocation.DateOf(now.In(loc))
	calls, ok, err := reserveCall(ctx, h.store.db, identity.CurrentUser(ctx).ID, day, DailyLimit)
	if err != nil {
		httpx.InternalError(w, h.log, "voice reserve", err)
		return
	}
	if !ok {
		h.store.record(ctx, h.log, home.ID, h.model, event{now: now, day: day.Time(), outcome: "skipped_cap"})
		httpx.WriteError(w, http.StatusTooManyRequests, "voice_daily_limit")
		return
	}

	callCtx, cancel := context.WithTimeout(ctx, callTimeout)
	start := time.Now()
	raw, usage, err := h.client.Complete(callCtx, llmalloc.Request{
		System: systemPrompt, User: userMessage(body.Locale, transcript, stored),
		MaxTokens: maxModelTokens, Tools: tools(),
	})
	cancel()
	ev := event{now: now, day: day.Time(), usage: usage, latency: time.Since(start), called: true}
	var toolCalls []llmalloc.ToolCall
	if err == nil {
		if toolCalls, err = decodeTools(raw); err != nil {
			err = llmalloc.ErrInvalidResponse
		}
	}
	if err != nil {
		status := http.StatusBadGateway
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			ev.outcome, status = "timeout", http.StatusGatewayTimeout
		case errors.Is(err, llmalloc.ErrInvalidResponse):
			ev.outcome = "invalid_response"
		default:
			ev.outcome = "error"
		}
		h.store.record(ctx, h.log, home.ID, h.model, ev)
		h.log.Warn("voice call failed", "outcome", ev.outcome)
		httpx.WriteError(w, status, "voice_unavailable")
		return
	}

	st, actions := interpretCalls(toolCalls, stored)
	ev.outcome, ev.sent, ev.accepted = "accepted", len(toolCalls), len(actions)
	h.store.record(ctx, h.log, home.ID, h.model, ev)
	httpx.WriteJSON(w, http.StatusOK, Response{Status: st, Actions: actions, Remaining: DailyLimit - calls})
}
