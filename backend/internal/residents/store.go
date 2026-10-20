// Package residents serves the Residents of a Home: who lives there, with the
// Streak and what each did today (see CONTEXT.md).
package residents

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound means no Resident with that id lives in the Home: the id is
// unknown, belongs to another Home, or the Resident has left.
var ErrNotFound = errors.New("resident not found")

// Find reads one Resident of homeID. Leaving deletes the residents row, so a
// former Resident, a Resident of another Home and an unknown id all give
// ErrNotFound alike.
func (s *Store) Find(ctx context.Context, homeID, residentID string) (Member, error) {
	var m Member
	var displayName *string
	var email string
	err := s.db.QueryRow(ctx, `
		SELECT r.id, u.id, u.display_name, u.email, u.photo_key
		FROM residents r JOIN users u ON u.id = r.user_id
		WHERE r.id = $1 AND r.home_id = $2`, residentID, homeID).
		Scan(&m.ID, &m.UserID, &displayName, &email, &m.PhotoKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrNotFound
	}
	if err != nil {
		return Member{}, fmt.Errorf("find resident: %w", err)
	}
	m.Name = identity.ShownName(displayName, email)
	return m, nil
}

// Completion is one Completion a Resident is on, with the people beside them.
type Completion struct {
	ID          string
	ChoreID     string
	ChoreName   string
	Category    string
	CompletedOn time.Time
	CompletedAt time.Time
	With        []Partner
}

// Partner is the other Resident on a two-person Completion.
type Partner struct {
	ID   string
	Name string
}

// CompletionsBetween lists the Completions residentID is on whose local date
// falls in from..to, newest date first, and within a date oldest first. It
// costs two queries: the Completions, then their partners (skipped when there
// are none).
func (s *Store) CompletionsBetween(ctx context.Context, homeID, residentID string, from, to time.Time) ([]Completion, error) {
	out, err := s.completions(ctx, homeID, residentID, from, to)
	if err != nil || len(out) == 0 {
		return nil, err
	}
	ids := make([]string, len(out))
	for i, k := range out {
		ids[i] = k.ID
	}
	partners, err := s.partnersOf(ctx, ids, residentID)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].With = partners[out[i].ID]
	}
	return out, nil
}

// completions is the first query of CompletionsBetween: the Completions alone.
// The handler's groupByDay relies on the ORDER BY: rows of one date are adjacent.
func (s *Store) completions(ctx context.Context, homeID, residentID string, from, to time.Time) ([]Completion, error) {
	rows, err := s.db.Query(ctx, `
		SELECT k.id, c.id, c.name, c.category, k.completed_on, k.completed_at
		FROM completions k
		JOIN completion_residents cr ON cr.completion_id = k.id AND cr.resident_id = $1
		JOIN tasks t ON t.id = k.task_id
		JOIN chores c ON c.id = t.chore_id
		WHERE c.home_id = $2 AND k.completed_on BETWEEN $3 AND $4
		ORDER BY k.completed_on DESC, k.completed_at ASC, k.id`, residentID, homeID, from, to)
	if err != nil {
		return nil, fmt.Errorf("list completions: %w", err)
	}
	defer rows.Close()
	var out []Completion
	for rows.Next() {
		var k Completion
		if err := rows.Scan(&k.ID, &k.ChoreID, &k.ChoreName, &k.Category, &k.CompletedOn, &k.CompletedAt); err != nil {
			return nil, fmt.Errorf("list completions: %w", err)
		}
		out = append(out, k)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list completions: %w", err)
	}
	return out, nil
}

// partnersOf is the second query: the other Residents on each Completion,
// keyed by Completion id, in joining order.
func (s *Store) partnersOf(ctx context.Context, completionIDs []string, residentID string) (map[string][]Partner, error) {
	partners, err := s.db.Query(ctx, `
		SELECT cr.completion_id, r.id, u.display_name, u.email
		FROM completion_residents cr
		JOIN residents r ON r.id = cr.resident_id
		JOIN users u ON u.id = r.user_id
		WHERE cr.completion_id = ANY($1::uuid[]) AND cr.resident_id <> $2
		ORDER BY r.created_at, r.id`, completionIDs, residentID)
	if err != nil {
		return nil, fmt.Errorf("list completion partners: %w", err)
	}
	defer partners.Close()
	byCompletion := map[string][]Partner{}
	for partners.Next() {
		var completionID string
		var p Partner
		var displayName *string
		var email string
		if err := partners.Scan(&completionID, &p.ID, &displayName, &email); err != nil {
			return nil, fmt.Errorf("list completion partners: %w", err)
		}
		p.Name = identity.ShownName(displayName, email)
		byCompletion[completionID] = append(byCompletion[completionID], p)
	}
	if err := partners.Err(); err != nil {
		return nil, fmt.Errorf("list completion partners: %w", err)
	}
	return byCompletion, nil
}

// Store reads the roster of a Home.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Member is a Resident as the store reads it. Name is the shown name, so the
// email never leaves the store. UserID is read for the avatar only.
type Member struct {
	ID       string
	UserID   string
	Name     string
	PhotoKey *string
}

// Roster lists the Residents of homeID in one query: the caller first, then
// the others in joining order. Leaving deletes the residents row, so a former
// Resident cannot appear.
func (s *Store) Roster(ctx context.Context, homeID, callerResidentID string) ([]Member, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.id, u.id, u.display_name, u.email, u.photo_key
		FROM residents r JOIN users u ON u.id = r.user_id
		WHERE r.home_id = $1
		ORDER BY (r.id = $2) DESC, r.created_at, r.id`, homeID, callerResidentID)
	if err != nil {
		return nil, fmt.Errorf("list residents: %w", err)
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		var displayName *string
		var email string
		if err := rows.Scan(&m.ID, &m.UserID, &displayName, &email, &m.PhotoKey); err != nil {
			return nil, fmt.Errorf("list residents: %w", err)
		}
		m.Name = identity.ShownName(displayName, email)
		out = append(out, m)
	}
	return out, rows.Err()
}
