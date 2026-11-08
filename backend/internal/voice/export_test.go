package voice

import (
	"context"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// ReserveCall exposes reserveCall to the counter tests.
func ReserveCall(ctx context.Context, q querier, userID string, date allocation.Date, limit int) (int, bool, error) {
	return reserveCall(ctx, q, userID, date, limit)
}
