package voice

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
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
