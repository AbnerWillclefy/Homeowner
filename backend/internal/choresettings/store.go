package choresettings

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound means the Chore does not exist in the Resident's Home. A Chore
// of another Home looks exactly the same.
var ErrNotFound = errors.New("chore not found")

// Store keeps the specific settings in resident_chore_preferences and
// resident_chore_restrictions. It has no HTTP types, so the Allocation job
// can reuse Effective (see effective.go).
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Setting a Preference or Restriction proves in the same statement that the
// Chore belongs to the Resident's Home (the schema cannot), and writes
// nothing when it does not. choreInHome is the shared test. Both sets always
// report a row when the Chore is in the Home, even when nothing changed, so
// zero rows means ErrNotFound.
const choreInHome = `EXISTS (SELECT 1 FROM chores c JOIN residents r ON r.home_id = c.home_id
	WHERE c.id = $2 AND r.id = $1 AND r.home_id = $3)`

// SetPreference sets the Resident's Preference on the Chore: like, neutral or
// dislike. Neutral is stored, so it beats a general Preference.
func (s *Store) SetPreference(ctx context.Context, homeID, residentID, choreID, preference string) error {
	tag, err := s.db.Exec(ctx, `
		INSERT INTO resident_chore_preferences (resident_id, chore_id, preference)
		SELECT $1::uuid, $2::uuid, $4::text WHERE `+choreInHome+`
		ON CONFLICT (resident_id, chore_id) DO UPDATE SET preference = EXCLUDED.preference`,
		residentID, choreID, homeID, preference)
	return written(tag.RowsAffected(), err, "set preference")
}

// AddRestriction restricts the Resident on the Chore; adding it twice is fine.
func (s *Store) AddRestriction(ctx context.Context, homeID, residentID, choreID string) error {
	// DO UPDATE with a no-op, not DO NOTHING, so an existing row still counts
	// as written.
	tag, err := s.db.Exec(ctx, `
		INSERT INTO resident_chore_restrictions (resident_id, chore_id)
		SELECT $1::uuid, $2::uuid WHERE `+choreInHome+`
		ON CONFLICT (resident_id, chore_id) DO UPDATE SET resident_id = EXCLUDED.resident_id`,
		residentID, choreID, homeID)
	return written(tag.RowsAffected(), err, "add restriction")
}

// ClearPreference removes the specific Preference, so the general one applies
// again. Clearing one never set is fine.
func (s *Store) ClearPreference(ctx context.Context, homeID, residentID, choreID string) error {
	return s.remove(ctx, "resident_chore_preferences", homeID, residentID, choreID, "clear preference")
}

// RemoveRestriction removes the specific Restriction; removing one never set
// is fine.
func (s *Store) RemoveRestriction(ctx context.Context, homeID, residentID, choreID string) error {
	return s.remove(ctx, "resident_chore_restrictions", homeID, residentID, choreID, "remove restriction")
}

// remove deletes the Resident's row for the Chore. A delete cannot report a
// row it did not find, so only when it touched none does it ask whether the
// Chore is in the Home: "never set" is fine, "not your Chore" is ErrNotFound.
func (s *Store) remove(ctx context.Context, table, homeID, residentID, choreID, what string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM `+table+` WHERE resident_id = $1 AND chore_id = $2`, residentID, choreID)
	if err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	var one int
	err = s.db.QueryRow(ctx, `SELECT 1 FROM chores WHERE id = $1 AND home_id = $2`, choreID, homeID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("%s: find chore: %w", what, err)
	}
	return nil
}

func written(rows int64, err error, what string) error {
	if err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
