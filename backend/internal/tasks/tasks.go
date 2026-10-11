// Package tasks keeps a Home's Tasks up to date and lists the open pool (see
// CONTEXT.md). The rule for when Tasks open and grow lives in the pure
// schedule package; this package reads, applies it and writes in one
// transaction.
package tasks

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/schedule"
)

// statementTimeout keeps a refresh well inside the Lambda limit.
const statementTimeout = "5s"

// Open is a Task in the open pool, with the Chore fields Residents need to
// see it.
type Open struct {
	ID            string `json:"id"`
	ChoreID       string `json:"choreId"`
	ChoreName     string `json:"choreName"`
	WindowStart   string `json:"windowStart"`
	WindowEnd     string `json:"windowEnd"`
	CurrentEffort int    `json:"currentEffort"`
	BaseEffort    int    `json:"baseEffort"`
	People        int    `json:"people"`
	Importance    string `json:"importance"`
}

// Store reads and writes the tasks table.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

const dateLayout = "2006-01-02"

func toDate(t time.Time) allocation.Date {
	return allocation.NewDate(t.Year(), t.Month(), t.Day())
}

func fromDate(d allocation.Date) time.Time {
	return time.Unix(int64(d)*86400, 0).UTC()
}

// Refresh brings the Home's Tasks up to date for the local date at now: it
// opens Tasks that are due and updates the current Effort of open ones. It is
// idempotent, since the result is derived from dates, and safe to run
// concurrently: each Chore row is locked while it is decided, and the partial
// unique index on open Tasks is the final guard. The daily Allocation job
// must call it before building its State.
func (s *Store) Refresh(ctx context.Context, homeID string, now time.Time) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("refresh tasks: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '"+statementTimeout+"'"); err != nil {
		return fmt.Errorf("refresh tasks: %w", err)
	}

	var zone string
	if err := tx.QueryRow(ctx, `SELECT timezone FROM homes WHERE id = $1`, homeID).Scan(&zone); err != nil {
		return fmt.Errorf("refresh tasks: load home: %w", err)
	}
	// Never fall back to UTC silently: a wrong day would open the wrong Tasks.
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return fmt.Errorf("refresh tasks: home timezone %q: %w", zone, err)
	}
	today := toDate(now.In(loc))

	type row struct {
		id     string
		chore  schedule.Chore
		latest *schedule.Task
		taskID string
	}
	// FOR UPDATE OF c serialises concurrent refreshes per Chore.
	rows, err := tx.Query(ctx, `
		SELECT c.id, c.base_effort, c.interval_days, c.allowed_weekdays, c.builds_up, c.created_at,
		       t.id, t.status, t.window_start, t.window_end, t.current_effort, t.closed_on
		FROM chores c
		LEFT JOIN LATERAL (
			SELECT * FROM tasks WHERE chore_id = c.id ORDER BY window_start DESC, created_at DESC LIMIT 1
		) t ON true
		WHERE c.home_id = $1
		ORDER BY c.created_at, c.id
		FOR UPDATE OF c`, homeID)
	if err != nil {
		return fmt.Errorf("refresh tasks: load chores: %w", err)
	}
	var all []row
	for rows.Next() {
		var (
			r        row
			interval *int32
			weekdays []int16
			created  time.Time
			tID      *string
			status   *string
			ws, we   *time.Time
			effort   *int16
			closedOn *time.Time
			base     int16
		)
		if err := rows.Scan(&r.id, &base, &interval, &weekdays, &r.chore.BuildsUp, &created,
			&tID, &status, &ws, &we, &effort, &closedOn); err != nil {
			rows.Close()
			return fmt.Errorf("refresh tasks: scan: %w", err)
		}
		r.chore.BaseEffort = int(base)
		if interval != nil {
			n := int(*interval)
			r.chore.IntervalDays = &n
		}
		for _, w := range weekdays {
			r.chore.AllowedWeekdays = append(r.chore.AllowedWeekdays, int(w))
		}
		r.chore.Created = toDate(created.In(loc))
		if tID != nil {
			r.taskID = *tID
			r.latest = &schedule.Task{
				Done:          *status == "done",
				WindowStart:   toDate(*ws),
				WindowEnd:     toDate(*we),
				CurrentEffort: int(*effort),
			}
			if closedOn != nil {
				r.latest.ClosedOn = toDate(*closedOn)
			}
		}
		all = append(all, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("refresh tasks: load chores: %w", err)
	}

	for _, r := range all {
		dec := schedule.Decide(r.chore, r.latest, today)
		switch dec.Action {
		case schedule.Open:
			// A conflict means an open Task already exists; the index decides.
			_, err = tx.Exec(ctx, `
				INSERT INTO tasks (chore_id, status, window_start, window_end, current_effort, created_at)
				VALUES ($1, 'open', $2, $3, $4, $5)
				ON CONFLICT DO NOTHING`,
				r.id, fromDate(dec.WindowStart), fromDate(dec.WindowEnd), dec.Effort, now)
		case schedule.SetEffort:
			_, err = tx.Exec(ctx, `UPDATE tasks SET current_effort = $2 WHERE id = $1`, r.taskID, dec.Effort)
		}
		if err != nil {
			return fmt.Errorf("refresh tasks: write: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("refresh tasks: %w", err)
	}
	return nil
}

// ListOpen returns the Home's open Tasks, oldest window first. Never nil.
func (s *Store) ListOpen(ctx context.Context, homeID string) ([]Open, error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.id, c.id, c.name, t.window_start, t.window_end, t.current_effort, c.base_effort, c.people, c.importance
		FROM tasks t JOIN chores c ON c.id = t.chore_id
		WHERE c.home_id = $1 AND t.status = 'open'
		ORDER BY t.window_start, c.created_at, t.id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("list open tasks: %w", err)
	}
	defer rows.Close()
	out := []Open{}
	for rows.Next() {
		var (
			o      Open
			ws, we time.Time
		)
		if err := rows.Scan(&o.ID, &o.ChoreID, &o.ChoreName, &ws, &we,
			&o.CurrentEffort, &o.BaseEffort, &o.People, &o.Importance); err != nil {
			return nil, fmt.Errorf("list open tasks: %w", err)
		}
		o.WindowStart, o.WindowEnd = ws.Format(dateLayout), we.Format(dateLayout)
		out = append(out, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list open tasks: %w", err)
	}
	return out, nil
}
