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

// financeTables is every finance table, children first. Each has user_id, and
// a test fails if the schema has a finance_* table that is not listed here, so
// a later ticket adds its table to this list.
var financeTables = []string{"finance_transactions", "finance_sources", "finance_items", "finance_credentials"}

// DeleteAll removes all of the User's finance data in one transaction. The
// cascades would remove the children anyway; listing every table keeps the
// intent visible and tested.
//
// A sync running meanwhile is harmless: it only inserts Transactions against an
// existing source_id, so once this commits its upserts fail on the foreign key
// and are logged. The sync never re-creates Items or Sources; only
// POST /me/finance/items does. The Item at Pluggy is not touched.
func (s *Store) DeleteAll(ctx context.Context, userID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	for _, table := range financeTables {
		if _, err := tx.Exec(ctx, `DELETE FROM `+table+` WHERE user_id = $1`, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
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

// Overview reads the whole status body: Sources, import state and credentials flag.
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
		SELECT EXISTS (SELECT 1 FROM finance_credentials WHERE user_id = $1),
		       COALESCE(bool_or(NOT import_complete), false),
		       CASE WHEN bool_or(last_synced_at IS NULL) THEN NULL ELSE min(last_synced_at) END
		FROM finance_items WHERE user_id = $1`, userID).Scan(&out.Configured, &out.Importing, &out.LastSyncedAt)
	return out, err
}

// DueItem is an Item to sync, with its User's sealed credentials.
type DueItem struct {
	ID, UserID, Email string
	IDEnc, SecretEnc  []byte
	ImportComplete    bool
}

// DueItems returns the Items that have credentials and have not finished the
// import or have not synced since staleBefore, the longest-waiting first.
func (s *Store) DueItems(ctx context.Context, staleBefore time.Time) ([]DueItem, error) {
	rows, err := s.db.Query(ctx, `
		SELECT i.id, i.user_id, u.email, i.import_complete, c.client_id_enc, c.client_secret_enc
		FROM finance_items i
		JOIN users u ON u.id = i.user_id
		JOIN finance_credentials c ON c.user_id = i.user_id
		WHERE NOT i.import_complete OR i.last_synced_at IS NULL OR i.last_synced_at < $1
		ORDER BY i.last_synced_at NULLS FIRST, i.id`, staleBefore)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DueItem
	for rows.Next() {
		var d DueItem
		if err := rows.Scan(&d.ID, &d.UserID, &d.Email, &d.ImportComplete, &d.IDEnc, &d.SecretEnc); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// SyncSource is a Source to read: its Pluggy account and how far it is imported.
type SyncSource struct {
	ID, PluggyAccountID string
	ImportCursor        *time.Time
}

// SyncSources returns the Item's Sources.
func (s *Store) SyncSources(ctx context.Context, itemID string) ([]SyncSource, error) {
	rows, err := s.db.Query(ctx, `SELECT id, pluggy_account_id, import_cursor FROM finance_sources WHERE item_id = $1 ORDER BY id`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SyncSource
	for rows.Next() {
		var src SyncSource
		if err := rows.Scan(&src.ID, &src.PluggyAccountID, &src.ImportCursor); err != nil {
			return nil, err
		}
		out = append(out, src)
	}
	return out, rows.Err()
}

// SetImportCursor records the last day of the Source that is fully imported.
func (s *Store) SetImportCursor(ctx context.Context, sourceID string, day time.Time) error {
	_, err := s.db.Exec(ctx, `UPDATE finance_sources SET import_cursor = $2 WHERE id = $1`, sourceID, day)
	return err
}

// FinishSync marks the Item imported and synced at now.
func (s *Store) FinishSync(ctx context.Context, itemID string, now time.Time) error {
	_, err := s.db.Exec(ctx, `UPDATE finance_items SET import_complete = true, last_synced_at = $2 WHERE id = $1`, itemID, now)
	return err
}

// Row is one Transaction to store, in the form the sync keeps.
type Row struct {
	ProviderID  string
	PostedOn    time.Time
	AmountCents int64
	Description string
	MerchantKey string
	Type        string
	// Installment fields are 0 when the row is not an installment.
	InstallmentNumber, TotalInstallments int32
}

// UpsertTransactions writes one page with a single statement. A Transaction
// seen again is refreshed, never duplicated; a type or category the User set
// stays. It inserts by source only, so a Source deleted meanwhile fails the
// foreign key instead of getting its rows back.
//
// Until the category rules exist, an expense is Other because nothing has
// decided yet ('fallback'). A category already set by the User or by a rule is
// kept, and so is the category of a row whose type the User set. shortcut: a sign flip on a row whose category is kept would break the
// type/category CHECK; Pluggy does not flip the sign of a posted row.
func (s *Store) UpsertTransactions(ctx context.Context, userID, sourceID string, rows []Row, now time.Time) error {
	n := len(rows)
	ids, days, cents, descs, keys, types := make([]string, n), make([]time.Time, n), make([]int64, n), make([]string, n), make([]string, n), make([]string, n)
	inst, total := make([]int32, n), make([]int32, n)
	for i, r := range rows {
		ids[i], days[i], cents[i], descs[i], keys[i], types[i] = r.ProviderID, r.PostedOn, r.AmountCents, r.Description, r.MerchantKey, r.Type
		inst[i], total[i] = r.InstallmentNumber, r.TotalInstallments
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT $1, $2, provider_id, posted_on, amount_cents, 'BRL', description, merchant_key, type, 'auto',
			CASE WHEN type = 'expense' THEN 'other' END, CASE WHEN type = 'expense' THEN 'fallback' END,
			NULLIF(inst, 0), NULLIF(total, 0), $3, $3
		FROM unnest($4::text[], $5::date[], $6::bigint[], $7::text[], $8::text[], $9::text[], $10::int[], $11::int[])
			AS p (provider_id, posted_on, amount_cents, description, merchant_key, type, inst, total)
		ON CONFLICT (source_id, provider_id) DO UPDATE SET
			posted_on = EXCLUDED.posted_on, amount_cents = EXCLUDED.amount_cents, description = EXCLUDED.description,
			merchant_key = EXCLUDED.merchant_key, installment_number = EXCLUDED.installment_number,
			total_installments = EXCLUDED.total_installments, updated_at = EXCLUDED.updated_at,
			type = CASE WHEN finance_transactions.type_set_by = 'user' THEN finance_transactions.type ELSE EXCLUDED.type END,
			spending_category = CASE WHEN finance_transactions.category_set_by IN ('user', 'auto') OR finance_transactions.type_set_by = 'user'
				THEN finance_transactions.spending_category ELSE EXCLUDED.spending_category END,
			category_set_by = CASE WHEN finance_transactions.category_set_by IN ('user', 'auto') OR finance_transactions.type_set_by = 'user'
				THEN finance_transactions.category_set_by ELSE EXCLUDED.category_set_by END`,
		userID, sourceID, now, ids, days, cents, descs, keys, types, inst, total)
	return err
}
