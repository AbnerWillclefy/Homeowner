package invites

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
)

const uniqueViolation = "23505"

// Store keeps Invites in the invites table. It imports homes, never the other
// way round.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Create makes an Invite to homeID for residentID and returns the token, which
// exists nowhere else and is shown once, and when it expires. It returns
// ErrTooManyOpen when the Home already has MaxOpenPerHome open Invites.
func (s *Store) Create(ctx context.Context, homeID, residentID string, now time.Time) (string, time.Time, error) {
	token, hash, err := newToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := now.Add(Validity)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("create invite: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Serialise creators for this Home so the cap holds; joiners are not
	// blocked (NO KEY UPDATE does not conflict with their foreign key checks).
	if _, err := tx.Exec(ctx, `SELECT 1 FROM homes WHERE id = $1 FOR NO KEY UPDATE`, homeID); err != nil {
		return "", time.Time{}, fmt.Errorf("lock home: %w", err)
	}
	var open int
	err = tx.QueryRow(ctx, `
		SELECT count(*) FROM invites
		WHERE home_id = $1 AND used_at IS NULL AND expires_at > $2`, homeID, now).Scan(&open)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("count open invites: %w", err)
	}
	if open >= MaxOpenPerHome {
		return "", time.Time{}, ErrTooManyOpen
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO invites (home_id, token_hash, created_by, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5)`, homeID, hash, residentID, now, expiresAt)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("insert invite: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return "", time.Time{}, fmt.Errorf("create invite: %w", err)
	}
	return token, expiresAt, nil
}

// Lookup reports whether the token names an Invite that can still be
// accepted. It never writes. The error is nil, ErrNotFound, ErrUsed or
// ErrExpired.
func (s *Store) Lookup(ctx context.Context, token string, now time.Time) error {
	hash, ok := hashToken(token)
	if !ok {
		return ErrNotFound
	}
	return s.state(ctx, s.db, hash, now)
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (s *Store) state(ctx context.Context, q queryer, hash []byte, now time.Time) error {
	var usedAt *time.Time
	var expiresAt time.Time
	err := q.QueryRow(ctx, `SELECT used_at, expires_at FROM invites WHERE token_hash = $1`, hash).Scan(&usedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("look up invite: %w", err)
	}
	return check(usedAt, expiresAt, now)
}

// Accept makes userID a Resident of the Invite's Home, in one transaction, so
// a failure never uses the Invite up. A User who lives in another Home must
// pass confirmLeave; the leave happens in the same transaction. Errors:
// ErrNotFound, ErrUsed, ErrExpired, ErrAlreadyHere, ErrWouldLeaveHome, and
// homes.ErrAlreadyResident when the User joined a Home concurrently.
func (s *Store) Accept(ctx context.Context, userID, token string, confirmLeave bool, now time.Time) (homes.Membership, error) {
	hash, ok := hashToken(token)
	if !ok {
		return homes.Membership{}, ErrNotFound
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return homes.Membership{}, fmt.Errorf("accept invite: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// The claim is the single-use guard: of two simultaneous accepts, exactly
	// one updates the row.
	var homeID string
	err = tx.QueryRow(ctx, `
		UPDATE invites SET used_at = $2, used_by = $3
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
		RETURNING home_id`, hash, now, userID).Scan(&homeID)
	if errors.Is(err, pgx.ErrNoRows) {
		if serr := s.state(ctx, tx, hash, now); serr != nil {
			return homes.Membership{}, serr
		}
		return homes.Membership{}, ErrUsed
	}
	if err != nil {
		return homes.Membership{}, fmt.Errorf("claim invite: %w", err)
	}

	var oldResident, oldHome string
	err = tx.QueryRow(ctx, `SELECT id, home_id FROM residents WHERE user_id = $1`, userID).Scan(&oldResident, &oldHome)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return homes.Membership{}, fmt.Errorf("find current home: %w", err)
	case oldHome == homeID:
		return homes.Membership{}, ErrAlreadyHere
	case !confirmLeave:
		return homes.Membership{}, ErrWouldLeaveHome
	default:
		if err := homes.LeaveTx(ctx, tx, oldResident, oldHome); err != nil {
			return homes.Membership{}, err
		}
	}

	m := homes.Membership{}
	err = tx.QueryRow(ctx, `
		INSERT INTO residents (user_id, home_id, created_at) VALUES ($1, $2, $3)
		RETURNING id`, userID, homeID, now).Scan(&m.ResidentID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return homes.Membership{}, homes.ErrAlreadyResident
	}
	if err != nil {
		return homes.Membership{}, fmt.Errorf("create resident: %w", err)
	}
	err = tx.QueryRow(ctx, `
		SELECT id, timezone, to_char(allocation_time, 'HH24:MI') FROM homes WHERE id = $1`, homeID).
		Scan(&m.Home.ID, &m.Home.Timezone, &m.Home.AllocationTime)
	if err != nil {
		return homes.Membership{}, fmt.Errorf("load home: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return homes.Membership{}, fmt.Errorf("accept invite: %w", err)
	}
	return m, nil
}
