// The Streak store reads a Resident's Streak from the history of Commitments,
// Completions and Check-ins. Nothing is stored: the Streak is computed on read
// by the pure rule in streak.go, so there is nothing to backfill and no drift.
// It disappears with the Resident (the history cascades).

package streak

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// Store reads Streaks.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// factsQuery gives one row per Resident and local date that has any fact for
// the Residents in $1 up to and including today ($2). Dates are the Home's
// local dates already, so there is no timezone arithmetic here.
//
// undone: their Commitments of that date whose Task has no Completion dated
// that same date. completions: the Completions they are on, by completed_on.
// drained: their Check-in of that date is Drained.
const factsQuery = `
SELECT resident_id::text, day, sum(completions)::int, sum(undone)::int, bool_or(drained)
FROM (
	SELECT tr.resident_id, tr.committed_on AS day, 0 AS completions,
	       (k.id IS NULL)::int AS undone, false AS drained
	FROM task_residents tr
	LEFT JOIN completions k ON k.task_id = tr.task_id AND k.completed_on = tr.committed_on
	WHERE tr.resident_id = ANY($1::uuid[]) AND tr.committed_on <= $2
	UNION ALL
	SELECT cr.resident_id, k.completed_on, 1, 0, false
	FROM completion_residents cr
	JOIN completions k ON k.id = cr.completion_id
	WHERE cr.resident_id = ANY($1::uuid[]) AND k.completed_on <= $2
	UNION ALL
	SELECT c.resident_id, c.checkin_date, 0, 0, true
	FROM checkins c
	WHERE c.resident_id = ANY($1::uuid[]) AND c.level = 'drained' AND c.checkin_date <= $2
) facts
GROUP BY resident_id, day`

// Reading is a Resident's Streak on today and what they did today.
type Reading struct {
	// Current is the Streak; TodayGrew says today already counts towards it.
	Current   int
	TodayGrew bool
	// DoneToday is how many Completions dated today the Resident is on. A
	// Completion by two people counts for both.
	DoneToday int
}

// CurrentFor reads the Streak of every Resident in residentIDs on today (their
// Home's local date) in one query, however many there are, and applies the
// pure rule to each. Every id has an entry; one with no history reads as zero.
func (s *Store) CurrentFor(ctx context.Context, residentIDs []string, today allocation.Date) (map[string]Reading, error) {
	rows, err := s.db.Query(ctx, factsQuery, residentIDs, today.Time())
	if err != nil {
		return nil, fmt.Errorf("streak: read history: %w", err)
	}
	defer rows.Close()
	days := make(map[string][]Day, len(residentIDs))
	for rows.Next() {
		var (
			id string
			on time.Time
			d  Day
		)
		if err := rows.Scan(&id, &on, &d.Completions, &d.Undone, &d.Drained); err != nil {
			return nil, fmt.Errorf("streak: read history: %w", err)
		}
		d.Date = allocation.DateOf(on)
		days[id] = append(days[id], d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("streak: read history: %w", err)
	}
	out := make(map[string]Reading, len(residentIDs))
	for _, id := range residentIDs {
		var r Reading
		r.Current, r.TodayGrew = Current(days[id], today)
		for _, d := range days[id] {
			if d.Date == today {
				r.DoneToday = d.Completions
			}
		}
		out[id] = r
	}
	return out, nil
}

// Current returns the Resident's Streak on today (their Home's local date) and
// whether today already counts towards it. It is CurrentFor for one Resident,
// so GET /home/streak and the Residents list cannot diverge.
func (s *Store) Current(ctx context.Context, residentID string, today allocation.Date) (current int, todayGrew bool, err error) {
	readings, err := s.CurrentFor(ctx, []string{residentID}, today)
	if err != nil {
		return 0, false, err
	}
	r := readings[residentID]
	return r.Current, r.TodayGrew, nil
}
