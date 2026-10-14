// Package users stores Users, the people with an account (see CONTEXT.md).
package users

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/onboarding"
)

// User is a person with an account.
type User = identity.User

// Store keeps Users in the users table.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// FindOrCreate returns the User with the Cognito subject sub, creating it on
// first sight and refreshing the email (it can change in Cognito; the subject
// is the identity). It is one statement, so two simultaneous first requests
// create exactly one row and both get it. now comes from the injected clock.
func (s *Store) FindOrCreate(ctx context.Context, sub, email string, now time.Time) (User, error) {
	u := User{CognitoSub: sub}
	err := s.db.QueryRow(ctx, `
		INSERT INTO users (cognito_sub, email, created_at, updated_at)
		VALUES ($1, $2, $3, $3)
		ON CONFLICT (cognito_sub) DO UPDATE
		SET email = EXCLUDED.email,
		    updated_at = EXCLUDED.updated_at
		RETURNING id, email, created_at`,
		sub, email, now).Scan(&u.ID, &u.Email, &u.CreatedAt)
	if err != nil {
		return User{}, fmt.Errorf("find or create user: %w", err)
	}
	return u, nil
}

// OnboardingStep returns the last onboarding step the User completed or
// skipped, "done", or "" when they have not started.
func (s *Store) OnboardingStep(ctx context.Context, userID string) (string, error) {
	var step *string
	if err := s.db.QueryRow(ctx, `SELECT onboarding_step FROM users WHERE id = $1`, userID).Scan(&step); err != nil {
		return "", fmt.Errorf("read onboarding step: %w", err)
	}
	if step == nil {
		return "", nil
	}
	return *step, nil
}

// AdvanceOnboarding stores step as the User's progress only if that moves it
// forward: it is one conditional UPDATE, not a read and a write, so two tabs
// racing cannot move progress backwards. Only not started and the steps
// before step (onboarding.Before) may be replaced. It returns the stored step
// afterwards, which is the old one when nothing moved.
func (s *Store) AdvanceOnboarding(ctx context.Context, userID, step string, now time.Time) (string, error) {
	var stored string
	err := s.db.QueryRow(ctx, `
		UPDATE users SET onboarding_step = $2, updated_at = $4
		WHERE id = $1 AND (onboarding_step IS NULL OR onboarding_step = ANY($3))
		RETURNING onboarding_step`, userID, step, onboarding.Before(step), now).Scan(&stored)
	if errors.Is(err, pgx.ErrNoRows) {
		return s.OnboardingStep(ctx, userID)
	}
	if err != nil {
		return "", fmt.Errorf("advance onboarding: %w", err)
	}
	return stored, nil
}

// Execer is what a pool or a transaction offers for writing.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// MarkOnboardingDone stores that the User finished onboarding, on ex so a
// caller can do it in its own transaction.
func MarkOnboardingDone(ctx context.Context, ex Execer, userID string, now time.Time) error {
	if _, err := ex.Exec(ctx, `UPDATE users SET onboarding_step = $2, updated_at = $3 WHERE id = $1`,
		userID, onboarding.Done, now); err != nil {
		return fmt.Errorf("finish onboarding: %w", err)
	}
	return nil
}
