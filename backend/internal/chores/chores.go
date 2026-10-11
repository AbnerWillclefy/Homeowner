// Package chores validates and stores a Home's Chores (see CONTEXT.md).
package chores

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// ErrNotFound means the Chore does not exist in that Home.
var ErrNotFound = errors.New("chore not found")

// Fields are the editable parts of a Chore, in the normalised form the
// database holds. IntervalDays nil means one-off. AllowedWeekdays uses
// 0 = Sunday to 6 = Saturday; empty means any day.
type Fields struct {
	Name            string
	Category        string
	Demands         []string
	BaseEffort      int
	Importance      string
	People          int
	IntervalDays    *int
	AllowedWeekdays []int
	BuildsUp        bool
}

// Chore is a stored Chore.
type Chore struct {
	ID string
	Fields
}

// Input is what a caller sends, before validation. The numbers are `any`
// (a JSON number arrives as float64) so a string or 2.5 is a field error with
// a code rather than an undifferentiated bad request. nil means missing.
type Input struct {
	Name            string
	Category        string
	Demands         []string
	BaseEffort      any
	Importance      string
	People          any
	IntervalDays    any // nil means one-off
	AllowedWeekdays []any
	BuildsUp        bool
}

// FieldErrors maps a wire field name to a stable machine code.
type FieldErrors map[string]string

const maxNameRunes = 100

// integer reports v as an int when it is a whole number.
func integer(v any) (int, bool) {
	f, ok := v.(float64)
	if !ok || f != float64(int(f)) || f > 1e9 || f < -1e9 {
		return 0, false
	}
	return int(f), true
}

// Validate checks in and returns it normalised: trimmed name, de-duplicated
// and sorted Demands and weekdays. All problems are reported at once.
func Validate(in Input) (Fields, FieldErrors) {
	errs := FieldErrors{}
	out := Fields{BuildsUp: in.BuildsUp}

	out.Name = strings.TrimSpace(in.Name)
	switch n := utf8.RuneCountInString(out.Name); {
	case n == 0:
		errs["name"] = "required"
	case n > maxNameRunes:
		errs["name"] = "too_long"
	}

	out.Category = in.Category
	switch {
	case in.Category == "":
		errs["category"] = "required"
	case !vocab.IsCategory(in.Category):
		errs["category"] = "unknown"
	}

	out.Importance = in.Importance
	switch allocation.Importance(in.Importance) {
	case allocation.Essential, allocation.Normal, allocation.NiceToHave:
	default:
		if in.Importance == "" {
			errs["importance"] = "required"
		} else {
			errs["importance"] = "unknown"
		}
	}

	out.Demands = []string{}
	for _, d := range in.Demands {
		if !vocab.IsDemand(d) {
			errs["demands"] = "unknown"
		} else if !slices.Contains(out.Demands, d) {
			out.Demands = append(out.Demands, d)
		}
	}
	slices.Sort(out.Demands)

	out.BaseEffort = intInRange(errs, "baseEffort", in.BaseEffort, 1, 5)
	out.People = intInRange(errs, "people", in.People, 1, 2)

	if in.IntervalDays != nil {
		n := intInRange(errs, "intervalDays", in.IntervalDays, 1, 365)
		out.IntervalDays = &n
	}

	out.AllowedWeekdays = []int{}
	for _, v := range in.AllowedWeekdays {
		d, ok := integer(v)
		switch {
		case !ok:
			errs["allowedWeekdays"] = "invalid"
		case d < 0 || d > 6:
			errs["allowedWeekdays"] = "out_of_range"
		case !slices.Contains(out.AllowedWeekdays, d):
			out.AllowedWeekdays = append(out.AllowedWeekdays, d)
		}
	}
	slices.Sort(out.AllowedWeekdays)

	if len(errs) > 0 {
		return Fields{}, errs
	}
	return out, nil
}

func intInRange(errs FieldErrors, field string, v any, lo, hi int) int {
	if v == nil {
		errs[field] = "required"
		return 0
	}
	n, ok := integer(v)
	switch {
	case !ok:
		errs[field] = "invalid"
	case n < lo || n > hi:
		errs[field] = "out_of_range"
	}
	return n
}

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
	var effort, people int16
	var interval *int32
	var weekdays []int16
	err := row.Scan(&c.ID, &c.Name, &c.Category, &c.Demands, &effort, &c.Importance, &people,
		&interval, &weekdays, &c.BuildsUp)
	if err != nil {
		return Chore{}, err
	}
	c.BaseEffort, c.People = int(effort), int(people)
	if interval != nil {
		n := int(*interval)
		c.IntervalDays = &n
	}
	c.AllowedWeekdays = make([]int, len(weekdays))
	for i, d := range weekdays {
		c.AllowedWeekdays[i] = int(d)
	}
	if c.Demands == nil {
		c.Demands = []string{}
	}
	return c, nil
}

func weekdays16(ds []int) []int16 {
	out := make([]int16, len(ds))
	for i, d := range ds {
		out[i] = int16(d)
	}
	return out
}

// List returns the Home's Chores, oldest first.
func (s *Store) List(ctx context.Context, homeID string) ([]Chore, error) {
	rows, err := s.db.Query(ctx,
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

// Create stores a new Chore in the Home.
func (s *Store) Create(ctx context.Context, homeID string, f Fields, now time.Time) (Chore, error) {
	c, err := scan(s.db.QueryRow(ctx, `
		INSERT INTO chores (home_id, name, category, demands, base_effort, importance, people,
			interval_days, allowed_weekdays, builds_up, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		RETURNING `+columns,
		homeID, f.Name, f.Category, f.Demands, f.BaseEffort, f.Importance, f.People,
		f.IntervalDays, weekdays16(f.AllowedWeekdays), f.BuildsUp, now))
	if err != nil {
		return Chore{}, fmt.Errorf("create chore: %w", err)
	}
	return c, nil
}

// isInvalidID reports a malformed uuid, which means the Chore cannot exist.
func isInvalidID(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}

// Update replaces every field of the Chore, or returns ErrNotFound.
func (s *Store) Update(ctx context.Context, homeID, id string, f Fields, now time.Time) (Chore, error) {
	c, err := scan(s.db.QueryRow(ctx, `
		UPDATE chores SET name = $3, category = $4, demands = $5, base_effort = $6, importance = $7,
			people = $8, interval_days = $9, allowed_weekdays = $10, builds_up = $11, updated_at = $12
		WHERE id = $2 AND home_id = $1
		RETURNING `+columns,
		homeID, id, f.Name, f.Category, f.Demands, f.BaseEffort, f.Importance, f.People,
		f.IntervalDays, weekdays16(f.AllowedWeekdays), f.BuildsUp, now))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidID(err) {
		return Chore{}, ErrNotFound
	}
	if err != nil {
		return Chore{}, fmt.Errorf("update chore: %w", err)
	}
	return c, nil
}

// Delete removes the Chore, or returns ErrNotFound.
func (s *Store) Delete(ctx context.Context, homeID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM chores WHERE id = $2 AND home_id = $1`, homeID, id)
	if isInvalidID(err) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete chore: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
