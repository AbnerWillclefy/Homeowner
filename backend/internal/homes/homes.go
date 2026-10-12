// Package homes stores Homes and their Residents (see CONTEXT.md).
package homes

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
)

var (
	// ErrAlreadyResident means the User already lives in a Home.
	ErrAlreadyResident = errors.New("user is already a resident of a home")
	// ErrNoHome means the User is not a Resident of any Home, or the Home is gone.
	ErrNoHome = errors.New("no home")
)

// Home is the place Residents look after together. AllocationTime is the
// local wall-clock time "HH:MM" in Timezone.
type Home struct {
	ID             string
	Timezone       string
	AllocationTime string
}

// Membership is a User's place in a Home: their own residents row and the
// Home it belongs to.
type Membership struct {
	ResidentID string
	Home       Home
}

// Store keeps Homes and Residents in the homes and residents tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

const uniqueViolation = "23505"

// Create makes a Home and makes userID its first Resident, in one transaction.
// The UNIQUE constraint on residents.user_id decides a race: the loser gets
// ErrAlreadyResident and its Home is rolled back. inHome, if not nil, runs on
// the open transaction once the Resident exists; if it fails, everything is
// rolled back.
func (s *Store) Create(ctx context.Context, userID, timezone, allocationTime string, now time.Time,
	initial []chores.Fields) (Home, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Home{}, fmt.Errorf("create home: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	h := Home{Timezone: timezone, AllocationTime: allocationTime}
	err = tx.QueryRow(ctx, `
		INSERT INTO homes (timezone, allocation_time, created_at, updated_at)
		VALUES ($1, $2::time, $3, $3)
		RETURNING id`,
		timezone, allocationTime, now).Scan(&h.ID)
	if err != nil {
		return Home{}, fmt.Errorf("create home: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO residents (user_id, home_id, created_at) VALUES ($1, $2, $3)`,
		userID, h.ID, now)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return Home{}, ErrAlreadyResident
	}
	if err != nil {
		return Home{}, fmt.Errorf("create resident: %w", err)
	}
	// Creating the Home is the last onboarding step; doing it here means a
	// crash before the client's next call cannot leave a Resident in the flow.
	if err := users.MarkOnboardingDone(ctx, tx, userID, now); err != nil {
		return Home{}, err
	}
	if err := chores.InsertAll(ctx, tx, h.ID, initial, now); err != nil {
		return Home{}, fmt.Errorf("create home: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Home{}, fmt.Errorf("create home: %w", err)
	}
	return h, nil
}

// ForUser returns the Home userID lives in and their Resident id there, or
// ErrNoHome.
func (s *Store) ForUser(ctx context.Context, userID string) (Membership, error) {
	var m Membership
	err := s.db.QueryRow(ctx, `
		SELECT h.id, r.id, h.timezone, to_char(h.allocation_time, 'HH24:MI')
		FROM residents r JOIN homes h ON h.id = r.home_id
		WHERE r.user_id = $1`, userID).Scan(&m.Home.ID, &m.ResidentID, &m.Home.Timezone, &m.Home.AllocationTime)
	if errors.Is(err, pgx.ErrNoRows) {
		return Membership{}, ErrNoHome
	}
	if err != nil {
		return Membership{}, fmt.Errorf("home for user: %w", err)
	}
	return m, nil
}

// UpdateSettings replaces the Home's timezone and Allocation time.
func (s *Store) UpdateSettings(ctx context.Context, homeID, timezone, allocationTime string, now time.Time) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE homes SET timezone = $2, allocation_time = $3::time, updated_at = $4
		WHERE id = $1`, homeID, timezone, allocationTime, now)
	if err != nil {
		return fmt.Errorf("update home settings: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNoHome
	}
	return nil
}
