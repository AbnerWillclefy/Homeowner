package finchat

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// reserveQuestion takes one of the User's limit questions for date, the São
// Paulo day, and returns the new count; ok is false when none is left. One
// statement inserts or increments, and the WHERE on the conflict update refuses
// at the limit, so concurrent callers can never go past it. Run it on the pool,
// not in a transaction: a rollback must not give back a question that was paid for.
func reserveQuestion(ctx context.Context, q querier, userID string, date time.Time, limit int) (questions int, ok bool, err error) {
	err = q.QueryRow(ctx, `
		INSERT INTO finance_chat_calls (user_id, call_date, questions) VALUES ($1, $2, 1)
		ON CONFLICT (user_id, call_date) DO UPDATE SET questions = finance_chat_calls.questions + 1
		WHERE finance_chat_calls.questions < $3
		RETURNING questions`, userID, date, limit).Scan(&questions)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("reserve chat question: %w", err)
	}
	return questions, true, nil
}

// event is one llm_call_events row of the chat: numbers and cost only, never words.
type event struct {
	now, day time.Time
	outcome  string
	usage    *llmalloc.Usage
	latency  time.Duration
	called   bool
	sent     int
}

const eventInsertTimeout = 5 * time.Second

// record writes the row, best effort. A failure logs the outcome and never
// the error, which could carry text.
func record(ctx context.Context, db *pgxpool.Pool, log *slog.Logger, model string, e event) {
	var in, out, cost, latency *int64
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
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), eventInsertTimeout)
	defer cancel()
	_, err := db.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, home_id, service, model, outcome, latency_ms,
		                             input_tokens, output_tokens, est_cost_micros, items_sent)
		VALUES ($1, $2, NULL, 'chat', $3, $4, $5, $6, $7, $8, $9)`,
		e.now, e.day, model, e.outcome, latency, in, out, cost, e.sent)
	if err != nil {
		log.Warn("llm call event not recorded", "service", "chat", "outcome", e.outcome)
	}
}
