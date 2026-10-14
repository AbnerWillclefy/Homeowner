// Package streakstore reads a Resident's Streak from the history of
// Commitments, Completions and Check-ins. Nothing is stored: the Streak is
// computed on read by the pure internal/streak package, so there is nothing to
// backfill and no drift. It disappears with the Resident (the history cascades).
package streakstore

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/streak"
)

// Store reads Streaks.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// factsQuery gives one row per local date that has any fact for the Resident
// ($1) up to and including today ($2). Dates are the Home's local dates
// already, so there is no timezone arithmetic here.
//
// undone: their Commitments of that date whose Task has no Completion dated
// that same date. completions: the Completions they are on, by completed_on.
// drained: their Check-in of that date is Drained.
const factsQuery = `
SELECT day, sum(completions)::int, sum(undone)::int, bool_or(drained)
FROM (
	SELECT tr.committed_on AS day, 0 AS completions,
	       (k.id IS NULL)::int AS undone, false AS drained
	FROM task_residents tr
	LEFT JOIN completions k ON k.task_id = tr.task_id AND k.completed_on = tr.committed_on
	WHERE tr.resident_id = $1 AND tr.committed_on <= $2
	UNION ALL
	SELECT k.completed_on, 1, 0, false
	FROM completion_residents cr
	JOIN completions k ON k.id = cr.completion_id
	WHERE cr.resident_id = $1 AND k.completed_on <= $2
	UNION ALL
	SELECT c.checkin_date, 0, 0, true
	FROM checkins c
	WHERE c.resident_id = $1 AND c.level = 'drained' AND c.checkin_date <= $2
) facts
GROUP BY day`

// Current returns the Resident's Streak on today (their Home's local date) and
// whether today already counts towards it.
func (s *Store) Current(ctx context.Context, residentID string, today allocation.Date) (current int, todayGrew bool, err error) {
	rows, err := s.db.Query(ctx, factsQuery, residentID, today.Time())
	if err != nil {
		return 0, false, fmt.Errorf("streak: read history: %w", err)
	}
	days, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (streak.Day, error) {
		var (
			on time.Time
			d  streak.Day
		)
		if err := row.Scan(&on, &d.Completions, &d.Undone, &d.Drained); err != nil {
			return d, err
		}
		d.Date = allocation.DateOf(on)
		return d, nil
	})
	if err != nil {
		return 0, false, fmt.Errorf("streak: read history: %w", err)
	}
	current, todayGrew = streak.Current(days, today)
	return current, todayGrew, nil
}
