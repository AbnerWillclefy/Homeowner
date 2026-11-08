package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
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

// Credentials returns the User's sealed Client ID and Secret; ok is false
// when none are saved.
func (s *Store) Credentials(ctx context.Context, userID string) (idEnc, secretEnc []byte, ok bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT client_id_enc, client_secret_enc FROM finance_credentials WHERE user_id = $1`, userID).Scan(&idEnc, &secretEnc)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, false, nil
	}
	return idEnc, secretEnc, err == nil, err
}

// NewSource is an account to store under an Item.
type NewSource struct {
	PluggyAccountID, Kind, Name, Currency string
}

// ConnectItem stores the User's Item and its Sources in one transaction.
// Calling it again changes no row count: the Item is kept as it was and each
// Source is refreshed in place.
func (s *Store) ConnectItem(ctx context.Context, userID, pluggyItemID string, now time.Time, sources []NewSource) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	var itemID string
	// DO UPDATE with the same value, so RETURNING gives the id on a repeat too.
	err = tx.QueryRow(ctx, `
		INSERT INTO finance_items (user_id, pluggy_item_id, connected_at) VALUES ($1, $2, $3)
		ON CONFLICT (user_id, pluggy_item_id) DO UPDATE SET pluggy_item_id = EXCLUDED.pluggy_item_id
		RETURNING id`, userID, pluggyItemID, now).Scan(&itemID)
	if err != nil {
		return err
	}
	for _, src := range sources {
		_, err = tx.Exec(ctx, `
			INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (item_id, pluggy_account_id) DO UPDATE SET kind = $4, name = $5, currency = $6`,
			userID, itemID, src.PluggyAccountID, src.Kind, src.Name, src.Currency)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Overview reads the Sources and the import state, the part of the status
// body that is not the credentials flag.
func (s *Store) Overview(ctx context.Context, userID string) (StatusResponse, error) {
	out := StatusResponse{Sources: []SourceResponse{}}
	rows, err := s.db.Query(ctx, `SELECT id, name, kind, currency FROM finance_sources WHERE user_id = $1 ORDER BY name, id`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var src SourceResponse
		if err := rows.Scan(&src.ID, &src.Name, &src.Kind, &src.Currency); err != nil {
			return out, err
		}
		out.Sources = append(out.Sources, src)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	// The oldest sync, or null while any Item has never synced.
	err = s.db.QueryRow(ctx, `
		SELECT COALESCE(bool_or(NOT import_complete), false),
		       CASE WHEN bool_or(last_synced_at IS NULL) THEN NULL ELSE min(last_synced_at) END
		FROM finance_items WHERE user_id = $1`, userID).Scan(&out.Importing, &out.LastSyncedAt)
	return out, err
}

// HasCredentials reports whether the User has saved credentials.
func (s *Store) HasCredentials(ctx context.Context, userID string) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM finance_credentials WHERE user_id = $1)`, userID).Scan(&ok)
	return ok, err
}
