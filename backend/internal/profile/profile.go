// Package profile stores a User's profile: Baseline Energy per weekday,
// Preference per Category and Restrictions on Demands (see CONTEXT.md). It is
// keyed to the User, not the Resident, so it survives leaving a Home.
package profile

import (
	"context"
	"fmt"
	"time"

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
	p := Profile{
		Baseline:     map[time.Weekday]int{},
		Preferences:  map[string]string{},
		Restrictions: []string{},
	}

	rows, err := s.db.Query(ctx, `SELECT weekday, points FROM user_baselines WHERE user_id = $1`, userID)
	if err != nil {
		return Profile{}, fmt.Errorf("load baseline: %w", err)
	}
	for rows.Next() {
		var day, points int
		if err := rows.Scan(&day, &points); err != nil {
			rows.Close()
			return Profile{}, fmt.Errorf("scan baseline: %w", err)
		}
		p.Baseline[time.Weekday(day)] = points
	}
	if err := rows.Err(); err != nil {
		return Profile{}, fmt.Errorf("load baseline: %w", err)
	}

	rows, err = s.db.Query(ctx, `SELECT category, preference FROM user_category_preferences WHERE user_id = $1`, userID)
	if err != nil {
		return Profile{}, fmt.Errorf("load preferences: %w", err)
	}
	for rows.Next() {
		var category, preference string
		if err := rows.Scan(&category, &preference); err != nil {
			rows.Close()
			return Profile{}, fmt.Errorf("scan preference: %w", err)
		}
		p.Preferences[category] = preference
	}
	if err := rows.Err(); err != nil {
		return Profile{}, fmt.Errorf("load preferences: %w", err)
	}

	rows, err = s.db.Query(ctx, `SELECT demand FROM user_demand_restrictions WHERE user_id = $1 ORDER BY demand`, userID)
	if err != nil {
		return Profile{}, fmt.Errorf("load restrictions: %w", err)
	}
	for rows.Next() {
		var demand string
		if err := rows.Scan(&demand); err != nil {
			rows.Close()
			return Profile{}, fmt.Errorf("scan restriction: %w", err)
		}
		p.Restrictions = append(p.Restrictions, demand)
	}
	if err := rows.Err(); err != nil {
		return Profile{}, fmt.Errorf("load restrictions: %w", err)
	}
	return p, nil
}

// SetBaseline sets the points of each day in set and clears each day in
// clear, in one transaction. Days in neither are untouched.
func (s *Store) SetBaseline(ctx context.Context, userID string, set map[time.Weekday]int, clear []time.Weekday) error {
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
	for _, day := range clear {
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
