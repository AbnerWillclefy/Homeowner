// Package users stores Users, the people with an account (see CONTEXT.md).
package users

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// User is a person with an account.
type User struct {
	ID         string
	CognitoSub string
	Email      string
	CreatedAt  time.Time
}

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
