package chores

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store keeps Chores in the chores table. Every query that takes a Chore id
// also filters on home_id, so one Home can never reach another's Chores.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

const columns = `id, name, category, demands, base_effort, importance, people,
	interval_days, allowed_weekdays, builds_up`

func scan(row pgx.Row) (Chore, error) {
	var c Chore
	err := row.Scan(&c.ID, &c.Name, &c.Category, &c.Demands, &c.BaseEffort, &c.Importance, &c.People,
		&c.IntervalDays, &c.AllowedWeekdays, &c.BuildsUp)
	return c, err
}

// List returns the Home's Chores, oldest first.
func (s *Store) List(ctx context.Context, homeID string) ([]Chore, error) {
	return ListIn(ctx, s.db, homeID)
}

// Querier is what a pool or a transaction offers for reading.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// ListIn is List on q, so a caller can read the Chores in its own
// transaction and snapshot.
func ListIn(ctx context.Context, q Querier, homeID string) ([]Chore, error) {
	rows, err := q.Query(ctx,
		`SELECT `+columns+` FROM chores WHERE home_id = $1 ORDER BY created_at, id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("list chores: %w", err)
	}
	defer rows.Close()
	out := []Chore{}
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("list chores: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// insertChore adds one Chore to a Home; insertArgs supplies its arguments.
const insertChore = `
	INSERT INTO chores (home_id, name, category, demands, base_effort, importance, people,
		interval_days, allowed_weekdays, builds_up, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`

func insertArgs(homeID string, f Fields, now time.Time) []any {
	return []any{homeID, f.Name, f.Category, f.Demands, f.BaseEffort, f.Importance, f.People,
		f.IntervalDays, f.AllowedWeekdays, f.BuildsUp, now}
}

// Create stores a new Chore in the Home.
func (s *Store) Create(ctx context.Context, homeID string, f Fields, now time.Time) (Chore, error) {
	c, err := scan(s.db.QueryRow(ctx, insertChore+` RETURNING `+columns, insertArgs(homeID, f, now)...))
	if err != nil {
		return Chore{}, fmt.Errorf("create chore: %w", err)
	}
	return c, nil
}

// Execer is what a pool or a transaction offers for writing.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// InsertAll stores the Chores in the Home on ex, so a caller can add them in
// its own transaction. All get the same creation time.
func InsertAll(ctx context.Context, ex Execer, homeID string, fs []Fields, now time.Time) error {
	for _, f := range fs {
		if _, err := ex.Exec(ctx, insertChore, insertArgs(homeID, f, now)...); err != nil {
			return fmt.Errorf("insert chore: %w", err)
		}
	}
	return nil
}

// Update replaces every field of the Chore, or returns ErrNotFound. id must
// satisfy ValidID.
func (s *Store) Update(ctx context.Context, homeID, id string, f Fields, now time.Time) (Chore, error) {
	c, err := scan(s.db.QueryRow(ctx, `
		UPDATE chores SET name = $3, category = $4, demands = $5, base_effort = $6, importance = $7,
			people = $8, interval_days = $9, allowed_weekdays = $10, builds_up = $11, updated_at = $12
		WHERE id = $2 AND home_id = $1
		RETURNING `+columns,
		homeID, id, f.Name, f.Category, f.Demands, f.BaseEffort, f.Importance, f.People,
		f.IntervalDays, f.AllowedWeekdays, f.BuildsUp, now))
	if errors.Is(err, pgx.ErrNoRows) {
		return Chore{}, ErrNotFound
	}
	if err != nil {
		return Chore{}, fmt.Errorf("update chore: %w", err)
	}
	return c, nil
}

// Delete removes the Chore, or returns ErrNotFound. id must satisfy ValidID.
func (s *Store) Delete(ctx context.Context, homeID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM chores WHERE id = $2 AND home_id = $1`, homeID, id)
	if err != nil {
		return fmt.Errorf("delete chore: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
