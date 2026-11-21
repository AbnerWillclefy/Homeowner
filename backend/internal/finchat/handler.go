package finchat

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	// maxBody holds 12 messages of up to 4,000 characters, with room for the JSON.
	maxBody        = 128 << 10
	maxMessages    = 12
	maxQuestion    = 500
	maxAnswer      = 4000
	maxModelTokens = 1024
	// maxToolsPerRound caps the tool uses run in one model reply.
	maxToolsPerRound = 4
)

// Screens are the keys Revenue sends for the screen the chat was opened from;
// "other" is a screen with no key of its own.
var screens = []string{"overview", "transactions", "bills", "card_bills", "categories", "goals", "net_worth", "projection", "sources", "settings", "other"}

// Model is the model behind the chat: *llmalloc.Anthropic or the scripted fake.
type Model interface {
	Converse(ctx context.Context, conv llmalloc.Conversation) (llmalloc.Turn, *llmalloc.Usage, error)
}

// Store counts the questions and records their events, and reads the Manual
// cards the redaction needs.
type Store struct {
	db  *pgxpool.Pool
	fin *finance.Store
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db, fin: finance.NewStore(db)} }

// Handler serves POST /me/finance/chat.
type Handler struct {
	model Model
	fin   *finance.Handler
	store *Store
	name  string
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler. A nil model means the chat is off. name is
// what an event row records when a call reported no Usage.
func NewHandler(model Model, fin *finance.Handler, store *Store, name string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{model: model, fin: fin, store: store, name: name, clock: clk, log: log}
}

// RequireConfigured wraps a handler so it answers 503 when the chat is off.
func (h *Handler) RequireConfigured(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.model == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "chat_unavailable")
			return
		}
		next(w, r)
	}
}

// validText reports whether s, trimmed, holds 1 to max runes and no control
// character but a newline or tab.
func validText(s string, max int) bool {
	n := utf8.RuneCountInString(s)
	return n > 0 && n <= max && !strings.ContainsFunc(s, func(r rune) bool { return unicode.IsControl(r) && r != '\n' && r != '\t' })
}

// valid reports whether the request is one the chat accepts. It never says why.
func valid(req *Request) bool {
	n := len(req.Messages)
	if !slices.Contains(screens, req.Screen) || (req.Locale != "pt-BR" && req.Locale != "en") || n < 1 || n > maxMessages {
		return false
	}
	for i := range req.Messages {
		m := &req.Messages[i]
		m.Text = strings.TrimSpace(m.Text)
		role, limit := "user", maxQuestion
		if (n-1-i)%2 == 1 {
			role, limit = "assistant", maxAnswer
		}
		if m.Role != role || !validText(m.Text, limit) {
			return false
		}
	}
	return true
}

// conversation is the messages the model gets: a leading assistant message is
// dropped, since the API rejects a conversation that starts with one.
func conversation(req Request, today string) llmalloc.Conversation {
	msgs := req.Messages
	if msgs[0].Role == "assistant" {
		msgs = msgs[1:]
	}
	conv := llmalloc.Conversation{System: systemPrompt(today, req.Screen, req.Locale), Tools: toolTable(), MaxTokens: maxModelTokens}
	for _, m := range msgs {
		conv.Messages = append(conv.Messages, llmalloc.Message{Role: llmalloc.Role(m.Role), Text: m.Text})
	}
	return conv
}

// Ask answers POST /me/finance/chat. It never logs or stores a question, an
// answer or a tool result.
func (h *Handler) Ask(w http.ResponseWriter, r *http.Request) {
	var req Request
	if !httpx.DecodeBody(w, r, &req, maxBody, true) {
		return
	}
	if !valid(&req) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_chat")
		return
	}

	ctx := r.Context()
	userID := identity.CurrentUser(ctx).ID
	now := h.clock.Now()
	day := finance.Today(now)
	questions, ok, err := reserveQuestion(ctx, h.store.db, userID, day, DailyLimit)
	if err != nil {
		h.fail(w, "chat reserve", err)
		return
	}
	if !ok {
		record(ctx, h.store.db, h.log, h.name, event{now: now, day: day, outcome: "skipped_cap"})
		httpx.WriteError(w, http.StatusTooManyRequests, "chat_daily_limit")
		return
	}

	qctx, cancel := context.WithTimeout(ctx, questionTimeout)
	defer cancel()
	conv := conversation(req, day.Format("2006-01-02"))
	for round := 0; ; round++ {
		start := time.Now()
		turn, usage, err := h.model.Converse(qctx, conv)
		ev := event{now: now, day: day, usage: usage, latency: time.Since(start), called: true, outcome: "accepted", sent: len(turn.ToolUses)}
		status := http.StatusBadGateway
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			ev.outcome, status = "timeout", http.StatusGatewayTimeout
		case errors.Is(err, llmalloc.ErrInvalidResponse):
			ev.outcome = "invalid_response"
		case err != nil:
			ev.outcome = "error"
		case len(turn.ToolUses) == 0 && utf8.RuneCountInString(turn.Text) > maxAnswer:
			// The browser sends it back as an earlier answer, so a longer one would fail validation.
			err, ev.outcome = llmalloc.ErrInvalidResponse, "invalid_response"
		case len(turn.ToolUses) > 0 && round == MaxRounds:
			err, ev.outcome, status = errors.New("tool round limit"), "invalid_response", http.StatusGatewayTimeout
		}
		record(ctx, h.store.db, h.log, h.name, ev)
		if ev.outcome != "accepted" {
			h.log.Warn("chat call failed", "outcome", ev.outcome)
			httpx.WriteError(w, status, "chat_unavailable")
			return
		}
		if len(turn.ToolUses) == 0 {
			httpx.WriteJSON(w, http.StatusOK, Response{Answer: turn.Text, Remaining: DailyLimit - questions})
			return
		}

		results, err := h.runTools(qctx, userID, turn.ToolUses)
		if errors.Is(err, context.DeadlineExceeded) {
			h.log.Warn("chat call failed", "outcome", "timeout")
			httpx.WriteError(w, http.StatusGatewayTimeout, "chat_unavailable")
			return
		}
		if err != nil {
			h.fail(w, "chat tool", err)
			return
		}
		conv.Messages = append(conv.Messages,
			llmalloc.Message{Role: llmalloc.RoleAssistant, ToolUses: turn.ToolUses},
			llmalloc.Message{Role: llmalloc.RoleUser, ToolResults: results})
	}
}

// runTools runs each tool use the model asked for, up to maxToolsPerRound;
// the extras get a tool error, not a run. An error is the database failing.
func (h *Handler) runTools(ctx context.Context, userID string, uses []llmalloc.ToolUse) ([]llmalloc.ToolResult, error) {
	results := make([]llmalloc.ToolResult, len(uses))
	for i, u := range uses {
		res := llmalloc.ToolResult{ToolUseID: u.ID, IsError: true}
		idx := slices.IndexFunc(tools, func(t tool) bool { return t.name == u.Name })
		switch {
		case i >= maxToolsPerRound:
			res.Content = "too many tool calls"
		case idx < 0:
			res.Content = "unknown tool"
		default:
			result, toolErr, err := tools[idx].run(ctx, h, userID, u.Input)
			if err != nil {
				return nil, err
			}
			res.Content = toolErr
			if toolErr == "" {
				b, err := json.Marshal(result)
				if err != nil {
					return nil, err
				}
				res.Content, res.IsError = string(b), false
			}
		}
		results[i] = res
	}
	return results, nil
}

// fail answers 500 and logs a fixed label and the pg error code, never the
// error, which can quote a row.
func (h *Handler) fail(w http.ResponseWriter, what string, err error) {
	code := "none"
	if pg, ok := errors.AsType[*pgconn.PgError](err); ok {
		code = pg.Code
	}
	h.log.Error(what, "pg_code", code)
	httpx.WriteError(w, http.StatusInternalServerError, "internal error")
}
