// Package checkinstore keeps Check-ins in the checkins tables. The rule that
// turns a Check-in into Energy is the pure internal/checkin package.
//
// A Check-in belongs to a Resident (not a User) and to one local date of their
// Home, and disappears when they leave. Its Restrictions hold for that date
// only and are never written to the User's lasting ones.
package checkinstore

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// CheckIn is a Resident's answer for one day.
type CheckIn struct {
	Level checkin.Level
	// Demands are today's extra Restrictions, known and without duplicates:
	// make a CheckIn with New.
	Demands []string
}

// ErrInvalidLevel and ErrUnknownDemand say why New refused its input.
var (
	ErrInvalidLevel  = errors.New("check-in level is not one of the four")
	ErrUnknownDemand = errors.New("check-in restriction is not a known demand")
)

// New is the one way to make a CheckIn from untrusted input: it checks the
// level and every Demand id and drops repeats, keeping the first-seen order.
// Save and the callers of CheckIn trust the result.
func New(level string, demands []string) (CheckIn, error) {
	l := checkin.Level(level)
	if !l.Valid() {
		return CheckIn{}, ErrInvalidLevel
	}
	out := CheckIn{Level: l, Demands: []string{}}
	for _, d := range demands {
		if !vocab.IsDemand(d) {
			return CheckIn{}, ErrUnknownDemand
		}
		if !slices.Contains(out.Demands, d) {
			out.Demands = append(out.Demands, d)
		}
	}
	return out, nil
}

// Querier is what a pool or a transaction offers for reading.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// Save stores the Check-in of the Resident for the date, replacing the level
// and the day Restrictions of an earlier one. now stamps it (the injected
// clock, never time.Now). The CheckIn must come from New; the SQL conflict
// clause is only a safety net for repeats.
func Save(ctx context.Context, tx pgx.Tx, residentID string, date allocation.Date, in CheckIn, now time.Time) error {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO checkins (resident_id, checkin_date, level, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $4)
		ON CONFLICT (resident_id, checkin_date) DO UPDATE SET level = EXCLUDED.level, updated_at = EXCLUDED.updated_at
		RETURNING id`, residentID, date.Time(), string(in.Level), now).Scan(&id)
	if err != nil {
		return fmt.Errorf("save check-in: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM checkin_demand_restrictions WHERE checkin_id = $1`, id); err != nil {
		return fmt.Errorf("save check-in: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO checkin_demand_restrictions (checkin_id, demand)
		SELECT $1, d FROM unnest($2::text[]) AS d ON CONFLICT DO NOTHING`, id, in.Demands); err != nil {
		return fmt.Errorf("save check-in: %w", err)
	}
	return nil
}

// LoadMany returns the Check-in of each of residentIDs that has one for the
// date, by Resident id, all on q so a caller reads them in its own snapshot.
// A Resident who has not checked in is absent from the map.
func LoadMany(ctx context.Context, q Querier, residentIDs []string, date allocation.Date) (map[string]CheckIn, error) {
	out := make(map[string]CheckIn, len(residentIDs))
	if len(residentIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT c.resident_id, c.level, COALESCE(array_agg(d.demand ORDER BY d.demand) FILTER (WHERE d.demand IS NOT NULL), '{}')
		FROM checkins c LEFT JOIN checkin_demand_restrictions d ON d.checkin_id = c.id
		WHERE c.resident_id = ANY($1) AND c.checkin_date = $2
		GROUP BY c.resident_id, c.level`, residentIDs, date.Time())
	if err != nil {
		return nil, fmt.Errorf("load check-ins: %w", err)
	}
	type row struct {
		resident string
		in       CheckIn
	}
	rs, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x row, err error) {
		var level string
		if err := r.Scan(&x.resident, &level, &x.in.Demands); err != nil {
			return x, err
		}
		x.in.Level = checkin.Level(level)
		return x, nil
	})
	if err != nil {
		return nil, fmt.Errorf("load check-ins: %w", err)
	}
	for _, x := range rs {
		out[x.resident] = x.in
	}
	return out, nil
}

// Store reads Check-ins for the API.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Get returns the Resident's Check-in for the date, and false when they have
// not checked in.
func (s *Store) Get(ctx context.Context, residentID string, date allocation.Date) (CheckIn, bool, error) {
	m, err := LoadMany(ctx, s.db, []string{residentID}, date)
	if err != nil {
		return CheckIn{}, false, err
	}
	in, ok := m[residentID]
	return in, ok, nil
}
