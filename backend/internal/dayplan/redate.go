package dayplan

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// The errors of MoveCompletion (ADR 0018).
var (
	// ErrCompletionNotFound: no such Completion in the Home.
	ErrCompletionNotFound = errors.New("completion not found")
	// ErrInFuture: the new time is after now.
	ErrInFuture = errors.New("completion time is in the future")
	// ErrTooOld: the new Home-local date is before today-29.
	ErrTooOld = errors.New("completion time is too old")
	// ErrBeforeTask: the new Home-local date is before the Task's window start.
	ErrBeforeTask = errors.New("completion time is before the task")
)

// maxBackDays is how far back a Completion may be re-dated.
const maxBackDays = 29

// MoveCompletion re-dates a Completion the Resident is named on to the instant
// at: it sets the Completion's time and Home-local date and the Task's closing
// date to that date in one transaction, so a recurring Chore restarts from the
// real day (ADR 0001, ADR 0018). It takes the Home lock, then the row locks, so
// it serialises with Complete and the Allocation.
func (p *Planner) MoveCompletion(ctx context.Context, homeID, residentID, completionID string, at, now time.Time) error {
	return p.inHomeTx(ctx, homeID, now, "move completion", func(tx pgx.Tx, clock homeClock) error {
		var (
			taskID      string
			windowStart time.Time
			named       bool
		)
		// Authorization is decided here, in SQL, against the Completion's Residents.
		err := tx.QueryRow(ctx, `
			SELECT k.task_id, t.window_start,
			       EXISTS (SELECT 1 FROM completion_residents WHERE completion_id = k.id AND resident_id = $3)
			FROM completions k
			JOIN tasks t ON t.id = k.task_id
			JOIN chores c ON c.id = t.chore_id
			WHERE k.id = $1 AND c.home_id = $2
			FOR UPDATE OF k, t`, completionID, homeID, residentID).Scan(&taskID, &windowStart, &named)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCompletionNotFound
		}
		if err != nil {
			return fmt.Errorf("move completion: %w", err)
		}
		if !named {
			return ErrNotYours
		}
		date := allocation.DateOf(at.In(clock.loc))
		switch {
		case at.After(now):
			return ErrInFuture
		case date < clock.date-maxBackDays:
			return ErrTooOld
		case date.Time().Before(windowStart):
			return ErrBeforeTask
		}
		if _, err := tx.Exec(ctx, `UPDATE completions SET completed_at = $2, completed_on = $3 WHERE id = $1`,
			completionID, at, date.Time()); err != nil {
			return fmt.Errorf("move completion: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE tasks SET closed_on = $2 WHERE id = $1`, taskID, date.Time()); err != nil {
			return fmt.Errorf("move completion: %w", err)
		}
		return nil
	})
}
