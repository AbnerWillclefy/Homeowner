package choresettings

import (
	"context"
	"errors"
	"fmt"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound means the Chore does not exist in the Resident's Home. A Chore
// of another Home looks exactly the same.
var ErrNotFound = errors.New("chore not found")

// ErrUnknownResident means the Resident is not in the Chore's Home.
var ErrUnknownResident = errors.New("unknown resident")

// ErrResponsibleRestricted means the Resident has a lasting Restriction on the
// Chore, so cannot be responsible for it. It carries why, as Resolve gives it.
type ErrResponsibleRestricted struct {
	ResidentID        string
	RestrictedBy      []string
	RestrictedByChore bool
}

func (e ErrResponsibleRestricted) Error() string { return "resident is restricted on the chore" }

// Store keeps the specific settings in resident_chore_preferences and
// resident_chore_restrictions. It has no HTTP types, so the Allocation job
// can reuse Effective (see effective.go).
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// SetResponsible makes the Resident responsible for the Chore. It locks the
// Chore first, then proves the Resident lives in the same Home (the schema
// cannot) and is not Restricted on it, so a Restriction added at the same time
// always ends up clearing it (see AddRestriction).
func (s *Store) SetResponsible(ctx context.Context, homeID, choreID, residentID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("set responsible: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var c Chore
	err = tx.QueryRow(ctx, `SELECT category, demands FROM chores WHERE id = $1 AND home_id = $2 FOR UPDATE`,
		choreID, homeID).Scan(&c.Category, &c.Demands)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("set responsible: lock chore: %w", err)
	}
	var userID string
	err = tx.QueryRow(ctx, `SELECT user_id FROM residents WHERE id = $1 AND home_id = $2 FOR SHARE`,
		residentID, homeID).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUnknownResident
	}
	if err != nil {
		return fmt.Errorf("set responsible: find resident: %w", err)
	}
	ps, err := profile.LoadMany(ctx, tx, []string{userID})
	if err != nil {
		return fmt.Errorf("set responsible: %w", err)
	}
	var spec Specific
	err = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM resident_chore_restrictions WHERE resident_id = $1 AND chore_id = $2)`,
		residentID, choreID).Scan(&spec.Restricted)
	if err != nil {
		return fmt.Errorf("set responsible: load restriction: %w", err)
	}
	if e := Resolve(c, General{Restrictions: ps[userID].Restrictions}, spec); e.Restricted {
		return ErrResponsibleRestricted{ResidentID: residentID, RestrictedBy: e.RestrictedBy, RestrictedByChore: e.RestrictedByChore}
	}
	// updated_at is left alone: nothing reads it for responsibility.
	if _, err := tx.Exec(ctx, `UPDATE chores SET responsible_resident_id = $1 WHERE id = $2`, residentID, choreID); err != nil {
		return fmt.Errorf("set responsible: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("set responsible: %w", err)
	}
	return nil
}

// ClearResponsible sets the Chore back to Nobody; clearing a Chore that
// already has Nobody is fine.
func (s *Store) ClearResponsible(ctx context.Context, homeID, choreID string) error {
	tag, err := s.db.Exec(ctx, `UPDATE chores SET responsible_resident_id = NULL WHERE id = $1 AND home_id = $2`,
		choreID, homeID)
	return written(tag.RowsAffected(), err, "clear responsible")
}

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
// When that Resident is the Chore's responsible one, the Chore goes back to
// Nobody: a Restriction is never refused, so it wins.
func (s *Store) AddRestriction(ctx context.Context, homeID, residentID, choreID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("add restriction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// Lock the Chore first so a concurrent SetResponsible either sees this
	// Restriction or is cleared by it; the INSERT's written check still 404s.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM chores WHERE id = $1 AND home_id = $2 FOR UPDATE`, choreID, homeID); err != nil {
		return fmt.Errorf("add restriction: lock chore: %w", err)
	}
	// DO UPDATE with a no-op, not DO NOTHING, so an existing row still counts
	// as written.
	tag, err := tx.Exec(ctx, `
		INSERT INTO resident_chore_restrictions (resident_id, chore_id)
		SELECT $1::uuid, $2::uuid WHERE `+choreInHome+`
		ON CONFLICT (resident_id, chore_id) DO UPDATE SET resident_id = EXCLUDED.resident_id`,
		residentID, choreID, homeID)
	if err := written(tag.RowsAffected(), err, "add restriction"); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE chores SET responsible_resident_id = NULL
		WHERE id = $1 AND home_id = $2 AND responsible_resident_id = $3`, choreID, homeID, residentID); err != nil {
		return fmt.Errorf("add restriction: clear responsibility: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("add restriction: %w", err)
	}
	return nil
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
