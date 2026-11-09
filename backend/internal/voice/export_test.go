package voice

import (
	"context"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// ReserveCall exposes reserveCall to the counter tests.
func ReserveCall(ctx context.Context, q querier, userID string, date allocation.Date, limit int) (int, bool, error) {
	return reserveCall(ctx, q, userID, date, limit)
}

// SetCallTimeout shortens the model deadline for a test and returns the undo.
func SetCallTimeout(d time.Duration) (restore func()) {
	old := callTimeout
	callTimeout = d
	return func() { callTimeout = old }
}
