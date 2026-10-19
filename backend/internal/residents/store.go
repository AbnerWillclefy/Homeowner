// Package residents serves the Residents of a Home: who lives there, with the
// Streak and what each did today (see CONTEXT.md).
package residents

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store reads the roster of a Home.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Member is a Resident as the store reads it. Email and UserID are read for
// the name and the avatar only; nothing here is serialised as it is.
type Member struct {
	ID          string
	UserID      string
	DisplayName *string
	Email       string
	PhotoKey    *string
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
		if err := rows.Scan(&m.ID, &m.UserID, &m.DisplayName, &m.Email, &m.PhotoKey); err != nil {
			return nil, fmt.Errorf("list residents: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
