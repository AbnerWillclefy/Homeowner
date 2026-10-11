// Package chores validates and stores a Home's Chores (see CONTEXT.md).
package chores

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// ErrNotFound means the Chore does not exist in that Home.
var ErrNotFound = errors.New("chore not found")

// Fields are the editable parts of a Chore, in the normalised form the
// database holds. IntervalDays nil means one-off. AllowedWeekdays uses
// 0 = Sunday to 6 = Saturday; empty means any day.
type Fields struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      int      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          int      `json:"people"`
	IntervalDays    *int     `json:"intervalDays"`
	AllowedWeekdays []int    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

// Chore is a stored Chore.
type Chore struct {
	ID string `json:"id"`
	Fields
}

// Input is what a caller sends, decoded straight from the request body,
// before validation. The numbers are `any` (a JSON number arrives as float64)
// so a string or 2.5 is a field error with a code rather than an
// undifferentiated bad request. nil means missing.
type Input struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      any      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          any      `json:"people"`
	IntervalDays    any      `json:"intervalDays"` // nil means one-off
	AllowedWeekdays []any    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

// FieldErrors maps a wire field name to a stable machine code. The first
// error recorded for a field wins.
type FieldErrors map[string]string

func (e FieldErrors) add(field, code string) {
	if _, seen := e[field]; !seen {
		e[field] = code
	}
}

// oneOf records "required" for an empty value and "unknown" for one that
// valid rejects.
func (e FieldErrors) oneOf(field, value string, valid func(string) bool) {
	switch {
	case value == "":
		e.add(field, "required")
	case !valid(value):
		e.add(field, "unknown")
	}
}

// intInRange returns v as a whole number in lo..hi, or records why not and
// returns 0.
func (e FieldErrors) intInRange(field string, v any, lo, hi int) int {
	if v == nil {
		e.add(field, "required")
		return 0
	}
	n, ok := integer(v)
	switch {
	case !ok:
		e.add(field, "invalid")
	case n < lo || n > hi:
		e.add(field, "out_of_range")
	default:
		return n
	}
	return 0
}

const maxNameRunes = 100

var idPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidID reports whether id is a well-formed uuid. A Chore with any other id
// cannot exist, so callers answer not found without asking the Store.
func ValidID(id string) bool { return idPattern.MatchString(id) }

// integer reports v as an int when it is a whole number.
func integer(v any) (int, bool) {
	f, ok := v.(float64)
	if !ok || f != float64(int(f)) || f > 1e9 || f < -1e9 {
		return 0, false
	}
	return int(f), true
}

// uniqueSorted returns the distinct values of in in ascending order, never nil.
func uniqueSorted[T cmp.Ordered](in []T) []T {
	out := append([]T{}, in...)
	slices.Sort(out)
	return slices.Compact(out)
}

// Validate checks in and returns it normalised: trimmed name, de-duplicated
// and sorted Demands and weekdays. All problems are reported at once.
func Validate(in Input) (Fields, FieldErrors) {
	errs := FieldErrors{}
	out := Fields{Category: in.Category, Importance: in.Importance, BuildsUp: in.BuildsUp}

	out.Name = strings.TrimSpace(in.Name)
	switch n := utf8.RuneCountInString(out.Name); {
	case n == 0:
		errs.add("name", "required")
	case n > maxNameRunes:
		errs.add("name", "too_long")
	}
	errs.oneOf("category", in.Category, vocab.IsCategory)
	errs.oneOf("importance", in.Importance, vocab.IsImportance)

	for _, d := range in.Demands {
		if !vocab.IsDemand(d) {
			errs.add("demands", "unknown")
		}
	}
	out.Demands = uniqueSorted(in.Demands)

	out.BaseEffort = errs.intInRange("baseEffort", in.BaseEffort, 1, 5)
	out.People = errs.intInRange("people", in.People, 1, 2)
	if in.IntervalDays != nil {
		n := errs.intInRange("intervalDays", in.IntervalDays, 1, 365)
		out.IntervalDays = &n
	}

	days := make([]int, 0, len(in.AllowedWeekdays))
	for _, v := range in.AllowedWeekdays {
		switch d, ok := integer(v); {
		case !ok:
			errs.add("allowedWeekdays", "invalid")
		case d < 0 || d > 6:
			errs.add("allowedWeekdays", "out_of_range")
		default:
			days = append(days, d)
		}
	}
	out.AllowedWeekdays = uniqueSorted(days)

	if len(errs) > 0 {
		return Fields{}, errs
	}
	return out, nil
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
