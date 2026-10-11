package choresettings

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

// ErrNotFound means the Chore does not exist in the Resident's Home. A Chore
// of another Home looks exactly the same.
var ErrNotFound = errors.New("chore not found")

// Store keeps the specific settings in resident_chore_preferences and
// resident_chore_restrictions. It has no HTTP types, so the Allocation job
// can reuse Effective.
type Store struct {
	db       *pgxpool.Pool
	chores   *chores.Store
	profiles *profile.Store
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db, chores: chores.NewStore(db), profiles: profile.NewStore(db)}
}

// Every write that names a Chore proves in the same statement that the Chore
// belongs to the Resident's Home (the schema cannot), and reports ErrNotFound
// when it does not. choreInHome is the shared test.
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

// ClearPreference removes the specific Preference, so the general one applies
// again. Clearing one never set is fine.
func (s *Store) ClearPreference(ctx context.Context, homeID, residentID, choreID string) error {
	return s.remove(ctx, "resident_chore_preferences", homeID, residentID, choreID, "clear preference")
}

// AddRestriction restricts the Resident on the Chore; adding it twice is fine.
func (s *Store) AddRestriction(ctx context.Context, homeID, residentID, choreID string) error {
	tag, err := s.db.Exec(ctx, `
		INSERT INTO resident_chore_restrictions (resident_id, chore_id)
		SELECT $1::uuid, $2::uuid WHERE `+choreInHome+`
		ON CONFLICT DO NOTHING`,
		residentID, choreID, homeID)
	if err == nil && tag.RowsAffected() == 0 {
		// Either already set or the Chore is not in the Home; tell them apart.
		return s.requireChore(ctx, homeID, choreID)
	}
	return written(tag.RowsAffected(), err, "add restriction")
}

// RemoveRestriction removes the specific Restriction; removing one never set
// is fine.
func (s *Store) RemoveRestriction(ctx context.Context, homeID, residentID, choreID string) error {
	return s.remove(ctx, "resident_chore_restrictions", homeID, residentID, choreID, "remove restriction")
}

func (s *Store) remove(ctx context.Context, table, homeID, residentID, choreID, what string) error {
	if err := s.requireChore(ctx, homeID, choreID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `DELETE FROM `+table+` WHERE resident_id = $1 AND chore_id = $2`, residentID, choreID)
	if err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	return nil
}

func (s *Store) requireChore(ctx context.Context, homeID, choreID string) error {
	var one int
	err := s.db.QueryRow(ctx, `SELECT 1 FROM chores WHERE id = $1 AND home_id = $2`, choreID, homeID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("find chore: %w", err)
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

// ResidentView is one Resident's effective settings on every Chore of the
// Home, keyed by Chore id. Never nil.
type ResidentView struct {
	ResidentID string
	Chores     map[string]Effective
}

// Effective returns the effective settings of every Resident of the Home on
// every Chore of the Home, Residents in joining order. Everything is read for
// homeID only.
func (s *Store) Effective(ctx context.Context, homeID string) ([]ResidentView, error) {
	cs, err := s.chores.List(ctx, homeID)
	if err != nil {
		return nil, err
	}

	type resident struct{ id, userID string }
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id FROM residents WHERE home_id = $1 ORDER BY created_at, id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("list residents: %w", err)
	}
	residents, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (resident, error) {
		var x resident
		return x, r.Scan(&x.id, &x.userID)
	})
	if err != nil {
		return nil, fmt.Errorf("list residents: %w", err)
	}

	type key struct{ resident, chore string }
	prefs := map[key]string{}
	rows, err = s.db.Query(ctx, `
		SELECT p.resident_id, p.chore_id, p.preference
		FROM resident_chore_preferences p JOIN residents r ON r.id = p.resident_id
		WHERE r.home_id = $1`, homeID)
	if err != nil {
		return nil, fmt.Errorf("load specific preferences: %w", err)
	}
	for rows.Next() {
		var k key
		var p string
		if err := rows.Scan(&k.resident, &k.chore, &p); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan specific preference: %w", err)
		}
		prefs[k] = p
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("load specific preferences: %w", err)
	}

	restricted := map[key]bool{}
	rows, err = s.db.Query(ctx, `
		SELECT q.resident_id, q.chore_id
		FROM resident_chore_restrictions q JOIN residents r ON r.id = q.resident_id
		WHERE r.home_id = $1`, homeID)
	if err != nil {
		return nil, fmt.Errorf("load specific restrictions: %w", err)
	}
	for rows.Next() {
		var k key
		if err := rows.Scan(&k.resident, &k.chore); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan specific restriction: %w", err)
		}
		restricted[k] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("load specific restrictions: %w", err)
	}

	out := make([]ResidentView, 0, len(residents))
	for _, r := range residents {
		p, err := s.profiles.Load(ctx, r.userID)
		if err != nil {
			return nil, err
		}
		g := General{Preferences: p.Preferences, Restrictions: p.Restrictions}
		v := ResidentView{ResidentID: r.id, Chores: make(map[string]Effective, len(cs))}
		for _, c := range cs {
			k := key{r.id, c.ID}
			v.Chores[c.ID] = Resolve(Chore{Category: c.Category, Demands: c.Demands}, g,
				Specific{Preference: prefs[k], Restricted: restricted[k]})
		}
		out = append(out, v)
	}
	return out, nil
}
