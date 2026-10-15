package dayplan

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// reserveLLMCall takes one of the Home's limit LLM calls for date and reports
// whether it got one. One statement inserts or increments, and the WHERE on
// the conflict update refuses at the limit, so concurrent callers can never
// go past it. Run it on the pool, not in a planning transaction: a rollback
// must not give back a call that was paid for.
func reserveLLMCall(ctx context.Context, q querier, homeID string, date allocation.Date, limit int) (bool, error) {
	var calls int
	err := q.QueryRow(ctx, `
		INSERT INTO llm_calls (home_id, call_date, calls) VALUES ($1, $2, 1)
		ON CONFLICT (home_id, call_date) DO UPDATE SET calls = llm_calls.calls + 1
		WHERE llm_calls.calls < $3
		RETURNING calls`, homeID, date.Time(), limit).Scan(&calls)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("reserve llm call: %w", err)
	}
	return true, nil
}
