package voice

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// reserveCall takes one of the User's limit voice calls for date, the Home's
// local date, and returns the new count; ok is false when none is left. One
// statement inserts or increments, and the WHERE on the conflict update refuses
// at the limit, so concurrent callers can never go past it. Run it on the pool,
// not in a transaction: a rollback must not give back a call that was paid for.
func reserveCall(ctx context.Context, q querier, userID string, date allocation.Date, limit int) (calls int, ok bool, err error) {
	err = q.QueryRow(ctx, `
		INSERT INTO voice_calls (user_id, call_date, calls) VALUES ($1, $2, 1)
		ON CONFLICT (user_id, call_date) DO UPDATE SET calls = voice_calls.calls + 1
		WHERE voice_calls.calls < $3
		RETURNING calls`, userID, date.Time(), limit).Scan(&calls)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("reserve voice call: %w", err)
	}
	return calls, true, nil
}

// Store counts voice calls and records their events. The Chores are read with
// chores.ListIn on the same pool.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// event is one llm_call_events row of voice: counts and cost only, never words.
type event struct {
	now, day       time.Time
	outcome        string
	usage          *llmalloc.Usage
	latency        time.Duration
	called         bool
	sent, accepted int
}

const eventInsertTimeout = 5 * time.Second

// record writes the row, best effort, as finance's recordEvent does. A failure
// logs the outcome and never the error, which could carry response text.
func (s *Store) record(ctx context.Context, log *slog.Logger, homeID, model string, e event) {
	var in, out, cost, latency, accepted *int64
	if u := e.usage; u != nil {
		model = u.Model
		in, out = &u.InputTokens, &u.OutputTokens
		if c, ok := llmalloc.Prices.Estimate(u); ok {
			cost = &c
		}
	}
	if e.called {
		ms := e.latency.Milliseconds()
		latency = &ms
	}
	if e.outcome == "accepted" {
		n := int64(e.accepted)
		accepted = &n
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), eventInsertTimeout)
	defer cancel()
	_, err := s.db.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, home_id, service, model, outcome, latency_ms,
		                             input_tokens, output_tokens, est_cost_micros, items_sent, items_accepted)
		VALUES ($1, $2, $3, 'voice', $4, $5, $6, $7, $8, $9, $10, $11)`,
		e.now, e.day, homeID, model, e.outcome, latency, in, out, cost, e.sent, accepted)
	if err != nil {
		log.Warn("llm call event not recorded", "service", "voice", "outcome", e.outcome)
	}
}
