package dayplan

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// LoadState exposes loadState to the edge tests in package dayplan_test.
func LoadState(ctx context.Context, q pgx.Tx, homeID string, today allocation.Date) (allocation.State, error) {
	l, err := loadState(ctx, q, homeID, today)
	return l.state, err
}
