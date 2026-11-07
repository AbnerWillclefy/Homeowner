package finance

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store keeps the sealed credentials in finance_credentials. It never sees a
// plaintext value.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// SaveCredentials inserts or replaces the User's sealed Client ID and Secret.
func (s *Store) SaveCredentials(ctx context.Context, userID string, idEnc, secretEnc []byte, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_credentials (user_id, client_id_enc, client_secret_enc, key_version, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id) DO UPDATE SET client_id_enc = $2, client_secret_enc = $3,
			key_version = $4, updated_at = $5`,
		userID, idEnc, secretEnc, KeyVersion, now)
	return err
}

// DeleteCredentials removes the User's credentials; no row is not an error.
func (s *Store) DeleteCredentials(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM finance_credentials WHERE user_id = $1`, userID)
	return err
}

// HasCredentials reports whether the User has saved credentials.
func (s *Store) HasCredentials(ctx context.Context, userID string) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM finance_credentials WHERE user_id = $1)`, userID).Scan(&ok)
	return ok, err
}
