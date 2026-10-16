package dayplan

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// LoadState exposes loadState to the edge tests in package dayplan_test.
func LoadState(ctx context.Context, q pgx.Tx, homeID string, today allocation.Date) (allocation.State, error) {
	l, err := loadState(ctx, q, homeID, today)
	return l.state, err
}

// RefreshStatementTimeout runs the Home lock and the Refresh of a plan
// transaction on db and returns statement_timeout before and after them.
func RefreshStatementTimeout(ctx context.Context, db *pgxpool.Pool, homeID string, now time.Time) (before, after string, err error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := tx.QueryRow(ctx, `SHOW statement_timeout`).Scan(&before); err != nil {
		return "", "", err
	}
	date, loc, err := lockHome(ctx, tx, homeID, now)
	if err != nil {
		return "", "", err
	}
	if err := tasks.RefreshIn(ctx, tx, homeID, date, loc, now); err != nil {
		return "", "", err
	}
	err = tx.QueryRow(ctx, `SHOW statement_timeout`).Scan(&after)
	return before, after, err
}

// ReserveLLMCall exposes reserveLLMCall to the cap tests.
func ReserveLLMCall(ctx context.Context, q querier, homeID string, date allocation.Date, limit int) (bool, error) {
	return reserveLLMCall(ctx, q, homeID, date, limit)
}
