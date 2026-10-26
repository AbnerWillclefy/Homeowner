// Package profile stores a User's profile: Baseline Energy per weekday,
// Preference per Category and Restrictions on Demands (see GLOSSARY.md). It is
// keyed to the User, not the Resident, so it survives leaving a Home.
package profile

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MaxBaseline is the largest Baseline in points. 0 means "nothing that day";
// an unset day is different and has no row. Keep in step with the CHECK in
// migrations/0004_user_profile.sql.
const MaxBaseline = 20

// Preference values. Neutral is stored as the absence of a row.
const (
	Like    = "like"
	Neutral = "neutral"
	Dislike = "dislike"
)

// Profile is everything a User has set. Baseline holds only the set days.
type Profile struct {
	Baseline     map[time.Weekday]int
	Preferences  map[string]string
	Restrictions []string
}

// Store keeps profiles in the user_* tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Load returns the whole profile of userID.
func (s *Store) Load(ctx context.Context, userID string) (Profile, error) {
	ps, err := LoadMany(ctx, s.db, []string{userID})
	if err != nil {
		return Profile{}, err
	}
	return ps[userID], nil
}

// Querier is what a pool or a transaction offers for reading.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// LoadMany returns the whole profile of each of userIDs in three queries, all
// on q so a caller can read them in its own snapshot. Every id is in the
// result, with an empty Profile when the User has set nothing.
func LoadMany(ctx context.Context, q Querier, userIDs []string) (map[string]Profile, error) {
	out := make(map[string]Profile, len(userIDs))
	for _, id := range userIDs {
		out[id] = Profile{
			Baseline:     map[time.Weekday]int{},
			Preferences:  map[string]string{},
			Restrictions: []string{},
		}
	}

	type baseline struct {
		user        string
		day, points int
	}
	bs, err := collect(ctx, q, `SELECT user_id, weekday, points FROM user_baselines WHERE user_id = ANY($1)`, userIDs,
		func(r pgx.CollectableRow) (b baseline, err error) { return b, r.Scan(&b.user, &b.day, &b.points) })
	if err != nil {
		return nil, fmt.Errorf("load baseline: %w", err)
	}
	for _, b := range bs {
		out[b.user].Baseline[time.Weekday(b.day)] = b.points
	}

	type preference struct{ user, category, preference string }
	prefs, err := collect(ctx, q, `SELECT user_id, category, preference FROM user_category_preferences WHERE user_id = ANY($1)`, userIDs,
		func(r pgx.CollectableRow) (p preference, err error) {
			return p, r.Scan(&p.user, &p.category, &p.preference)
		})
	if err != nil {
		return nil, fmt.Errorf("load preferences: %w", err)
	}
	for _, p := range prefs {
		out[p.user].Preferences[p.category] = p.preference
	}

	type restriction struct{ user, demand string }
	rs, err := collect(ctx, q, `SELECT user_id, demand FROM user_demand_restrictions WHERE user_id = ANY($1)`, userIDs,
		func(r pgx.CollectableRow) (x restriction, err error) { return x, r.Scan(&x.user, &x.demand) })
	if err != nil {
		return nil, fmt.Errorf("load restrictions: %w", err)
	}
	for _, x := range rs {
		p := out[x.user]
		p.Restrictions = append(p.Restrictions, x.demand)
		out[x.user] = p
	}
	return out, nil
}

func collect[T any](ctx context.Context, q Querier, sql string, userIDs []string, scan pgx.RowToFunc[T]) ([]T, error) {
	rows, err := q.Query(ctx, sql, userIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scan)
}

// SetBaseline sets the points of each day in set and clears each day in
// cleared, in one transaction. Days in neither are untouched.
func (s *Store) SetBaseline(ctx context.Context, userID string, set map[time.Weekday]int, cleared []time.Weekday) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("set baseline: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for day, points := range set {
		_, err := tx.Exec(ctx, `
			INSERT INTO user_baselines (user_id, weekday, points) VALUES ($1, $2, $3)
			ON CONFLICT (user_id, weekday) DO UPDATE SET points = EXCLUDED.points`,
			userID, int(day), points)
		if err != nil {
			return fmt.Errorf("set baseline: %w", err)
		}
	}
	for _, day := range cleared {
		if _, err := tx.Exec(ctx, `DELETE FROM user_baselines WHERE user_id = $1 AND weekday = $2`, userID, int(day)); err != nil {
			return fmt.Errorf("clear baseline: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("set baseline: %w", err)
	}
	return nil
}

// SetPreference sets the Preference for category; Neutral removes it.
func (s *Store) SetPreference(ctx context.Context, userID, category, preference string) error {
	var err error
	if preference == Neutral {
		_, err = s.db.Exec(ctx, `DELETE FROM user_category_preferences WHERE user_id = $1 AND category = $2`, userID, category)
	} else {
		_, err = s.db.Exec(ctx, `
			INSERT INTO user_category_preferences (user_id, category, preference) VALUES ($1, $2, $3)
			ON CONFLICT (user_id, category) DO UPDATE SET preference = EXCLUDED.preference`,
			userID, category, preference)
	}
	if err != nil {
		return fmt.Errorf("set preference: %w", err)
	}
	return nil
}

// AddRestriction adds a Restriction on demand; adding it twice is fine.
func (s *Store) AddRestriction(ctx context.Context, userID, demand string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO user_demand_restrictions (user_id, demand) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, userID, demand)
	if err != nil {
		return fmt.Errorf("add restriction: %w", err)
	}
	return nil
}

// RemoveRestriction removes a Restriction; removing one never set is fine.
func (s *Store) RemoveRestriction(ctx context.Context, userID, demand string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM user_demand_restrictions WHERE user_id = $1 AND demand = $2`, userID, demand)
	if err != nil {
		return fmt.Errorf("remove restriction: %w", err)
	}
	return nil
}
