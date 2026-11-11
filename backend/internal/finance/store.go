package finance

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
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

// SetIncome stores the User's Monthly income; nil clears it.
func (s *Store) SetIncome(ctx context.Context, userID string, cents *int64, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_settings (user_id, monthly_income_cents, updated_at) VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET monthly_income_cents = $2, updated_at = $3`,
		userID, cents, now)
	return err
}

// Income returns the User's Monthly income, nil when not set.
func (s *Store) Income(ctx context.Context, userID string) (*int64, error) {
	var cents *int64
	err := s.db.QueryRow(ctx, `SELECT monthly_income_cents FROM finance_settings WHERE user_id = $1`, userID).Scan(&cents)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return cents, err
}

// financeTables is every finance table, children first. Each has user_id, and
// a test fails if the schema has a finance_* table that is not listed here, so
// a later ticket adds its table to this list.
var financeTables = []string{"finance_card_bills", "finance_transactions", "finance_sources", "finance_items", "finance_credentials",
	"finance_merchant_categories", "finance_llm_calls", "finance_bill_reminders", "finance_bill_payments", "finance_bills", "finance_settings", "finance_category_budgets", "finance_bill_suggestion_dismissals",
	"finance_investments", "finance_goals"}

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
	// CloseDay and DueDay are a card's bill days; 0 stores null.
	CloseDay, DueDay int
}

// ConnectItem stores the User's Item and its Sources in one transaction.
// Calling it again changes no row count: the Item is kept as it was and each
// Source is refreshed in place, except a card's bill days, which Pluggy fills
// only while the card has none.
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
			INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency, bill_close_day, bill_due_day)
			VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, 0), NULLIF($8, 0))
			ON CONFLICT (item_id, pluggy_account_id) DO UPDATE SET kind = $4, name = $5, currency = $6,
				bill_close_day = CASE WHEN finance_sources.bill_close_day IS NULL AND finance_sources.bill_due_day IS NULL
					THEN NULLIF($7, 0) ELSE finance_sources.bill_close_day END,
				bill_due_day = CASE WHEN finance_sources.bill_close_day IS NULL AND finance_sources.bill_due_day IS NULL
					THEN NULLIF($8, 0) ELSE finance_sources.bill_due_day END`,
			userID, itemID, src.PluggyAccountID, src.Kind, src.Name, src.Currency, src.CloseDay, src.DueDay)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Overview reads the whole status body: Sources, import state and credentials flag.
func (s *Store) Overview(ctx context.Context, userID string) (StatusResponse, error) {
	out := StatusResponse{Sources: []SourceResponse{}}
	rows, err := s.db.Query(ctx, `SELECT id, COALESCE(display_name, name) AS shown, name, kind, currency, bill_close_day, bill_due_day FROM finance_sources WHERE user_id = $1 ORDER BY shown, id`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var src SourceResponse
		if err := rows.Scan(&src.ID, &src.Name, &src.BankName, &src.Kind, &src.Currency, &src.CloseDay, &src.DueDay); err != nil {
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
	ID, UserID, Email, PluggyItemID string
	IDEnc, SecretEnc                []byte
	ImportComplete                  bool
}

// DueItems returns the Items that have credentials and have not finished the
// import or have not synced since staleBefore, the longest-waiting first.
func (s *Store) DueItems(ctx context.Context, staleBefore time.Time) ([]DueItem, error) {
	rows, err := s.db.Query(ctx, `
		SELECT i.id, i.user_id, u.email, i.pluggy_item_id, i.import_complete, c.client_id_enc, c.client_secret_enc
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
		if err := rows.Scan(&d.ID, &d.UserID, &d.Email, &d.PluggyItemID, &d.ImportComplete, &d.IDEnc, &d.SecretEnc); err != nil {
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
	Card                bool
}

// SyncSources returns the Item's Sources.
func (s *Store) SyncSources(ctx context.Context, itemID string) ([]SyncSource, error) {
	rows, err := s.db.Query(ctx, `SELECT id, pluggy_account_id, import_cursor, kind = 'credit_card' FROM finance_sources WHERE item_id = $1 ORDER BY id`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SyncSource
	for rows.Next() {
		var src SyncSource
		if err := rows.Scan(&src.ID, &src.PluggyAccountID, &src.ImportCursor, &src.Card); err != nil {
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

// SetBillDays fills the bill days of the Item's card Sources from Pluggy's
// accounts, only for a card with neither day stored, so a day the User typed
// stays; an account the Item does not hold is ignored.
func (s *Store) SetBillDays(ctx context.Context, itemID string, accounts []pluggy.Account) error {
	for _, a := range accounts {
		if a.CloseDay == 0 || a.DueDay == 0 {
			continue
		}
		_, err := s.db.Exec(ctx, `UPDATE finance_sources SET bill_close_day = $3, bill_due_day = $4
			WHERE item_id = $1 AND pluggy_account_id = $2 AND kind = 'credit_card'
				AND bill_close_day IS NULL AND bill_due_day IS NULL`, itemID, a.ID, a.CloseDay, a.DueDay)
		if err != nil {
			return err
		}
	}
	return nil
}

// SetBillDaysByHand stores the days a User typed on one of their card Sources,
// or clears both with nil. found is false for another User's Source and for any
// Source that is not a credit card.
func (s *Store) SetBillDaysByHand(ctx context.Context, userID, sourceID string, closeDay, dueDay *int) (found bool, err error) {
	tag, err := s.db.Exec(ctx, `UPDATE finance_sources SET bill_close_day = $3, bill_due_day = $4
		WHERE id = $1 AND user_id = $2 AND kind = 'credit_card'`, sourceID, userID, closeDay, dueDay)
	return tag.RowsAffected() == 1, err
}

// SetDisplayName stores the name a User gave one of their Sources, or clears it
// with nil. found is false for another User's Source. A sync never writes it.
func (s *Store) SetDisplayName(ctx context.Context, userID, sourceID string, name *string) (found bool, err error) {
	tag, err := s.db.Exec(ctx, `UPDATE finance_sources SET display_name = $3 WHERE id = $1 AND user_id = $2`, sourceID, userID, name)
	return tag.RowsAffected() == 1, err
}

// UpsertCardBills stores the bank's bills of one card Source, so a bill the
// bank corrects is updated. A bill that is not BRL is left out.
func (s *Store) UpsertCardBills(ctx context.Context, userID, sourceID string, bills []pluggy.Bill) error {
	var ids []string
	var closes, dues []time.Time
	var totals []int64
	for _, b := range bills {
		if b.Currency != "BRL" {
			continue
		}
		ids, closes, dues, totals = append(ids, b.ID), append(closes, postedOn(b.ClosingDate)), append(dues, postedOn(b.DueDate)), append(totals, b.TotalCents)
	}
	if len(ids) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT $1, $2, * FROM unnest($3::text[], $4::date[], $5::date[], $6::bigint[])
		ON CONFLICT (source_id, provider_id) DO UPDATE SET closes_on = EXCLUDED.closes_on, due_on = EXCLUDED.due_on, total_cents = EXCLUDED.total_cents`,
		userID, sourceID, ids, closes, dues, totals)
	return err
}

// CardBillsDue returns the User's stored card bills due in [from, to].
func (s *Store) CardBillsDue(ctx context.Context, userID string, from, to time.Time) ([]StoredBill, error) {
	rows, err := s.db.Query(ctx, `SELECT closes_on, due_on, total_cents FROM finance_card_bills
		WHERE user_id = $1 AND due_on BETWEEN $2 AND $3`, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StoredBill
	for rows.Next() {
		var b StoredBill
		if err := rows.Scan(&b.ClosesOn, &b.DueOn, &b.TotalCents); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// FinishSync marks the Item imported and synced at now.
func (s *Store) FinishSync(ctx context.Context, itemID string, now time.Time) error {
	_, err := s.db.Exec(ctx, `UPDATE finance_items SET import_complete = true, last_synced_at = $2 WHERE id = $1`, itemID, now)
	return err
}

// ClassifyInput returns the User's auto Transactions posted in [from, to] on
// every Source, and the kind of each Source, for Classify.
func (s *Store) ClassifyInput(ctx context.Context, userID string, from, to time.Time) ([]Txn, map[string]Kind, error) {
	kinds := map[string]Kind{}
	srcs, err := s.db.Query(ctx, `SELECT id, kind FROM finance_sources WHERE user_id = $1`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer srcs.Close()
	for srcs.Next() {
		var id string
		var k Kind
		if err := srcs.Scan(&id, &k); err != nil {
			return nil, nil, err
		}
		kinds[id] = k
	}
	if err := srcs.Err(); err != nil {
		return nil, nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT id, source_id, currency, merchant_key, posted_on, amount_cents, type, type_set_by,
		       COALESCE(spending_category, ''), COALESCE(category_set_by, '')
		FROM finance_transactions
		WHERE user_id = $1 AND type_set_by = 'auto' AND posted_on BETWEEN $2 AND $3`, userID, from, to)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var out []Txn
	for rows.Next() {
		var t Txn
		if err := rows.Scan(&t.ID, &t.SourceID, &t.Currency, &t.MerchantKey, &t.PostedOn, &t.AmountCents, &t.Type, &t.TypeSetBy, &t.Category, &t.CategorySetBy); err != nil {
			return nil, nil, err
		}
		out = append(out, t)
	}
	return out, kinds, rows.Err()
}

// SetClassified writes the type and category Classify decided. A row the User
// set meanwhile is left alone.
func (s *Store) SetClassified(ctx context.Context, txns []Txn, now time.Time) error {
	n := len(txns)
	ids, types, cats, by := make([]string, n), make([]string, n), make([]string, n), make([]string, n)
	for i, t := range txns {
		ids[i], types[i], cats[i], by[i] = t.ID, t.Type, t.Category, t.CategorySetBy
	}
	_, err := s.db.Exec(ctx, `
		UPDATE finance_transactions f SET type = p.type, spending_category = NULLIF(p.category, ''),
			category_set_by = NULLIF(p.by, ''), updated_at = $5
		FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) AS p (id, type, category, by)
		WHERE f.id = p.id AND f.type_set_by = 'auto'`, ids, types, cats, by, now)
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
	// Category is the Spending Category Pluggy's own category maps to, "" if none.
	Category string
}

// UpsertTransactions writes one page with a single statement. A Transaction
// seen again is refreshed, never duplicated; a type or category the User set
// stays. It inserts by source only, so a Source deleted meanwhile fails the
// foreign key instead of getting its rows back.
//
// The type and category of a stored row are kept together: classify re-decides
// every auto row of the page right after, and taking either from the sign-based
// insert values would break the type/category CHECK on a transfer or a card
// refund. Only a 'fallback' category on a row that is still an expense takes a
// category Pluggy now gives. A new expense is Other because nothing has decided yet ('fallback').
// shortcut: a sign flip on a stored row is ignored; Pluggy does not flip the
// sign of a posted row.
func (s *Store) UpsertTransactions(ctx context.Context, userID, sourceID string, rows []Row, now time.Time) error {
	n := len(rows)
	ids, days, cents, descs, keys, types := make([]string, n), make([]time.Time, n), make([]int64, n), make([]string, n), make([]string, n), make([]string, n)
	inst, total, cats := make([]int32, n), make([]int32, n), make([]string, n)
	for i, r := range rows {
		cats[i] = r.Category
		ids[i], days[i], cents[i], descs[i], keys[i], types[i] = r.ProviderID, r.PostedOn, r.AmountCents, r.Description, r.MerchantKey, r.Type
		inst[i], total[i] = r.InstallmentNumber, r.TotalInstallments
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT $1, $2, p.provider_id, p.posted_on, p.amount_cents, 'BRL', p.description, p.merchant_key, p.type, 'auto',
			CASE WHEN p.type = 'expense' THEN COALESCE(mc.spending_category, NULLIF(p.category, ''), 'other') END,
			CASE WHEN p.type = 'expense' THEN
				CASE WHEN mc.spending_category IS NOT NULL OR p.category <> '' THEN 'auto' ELSE 'fallback' END END,
			NULLIF(p.inst, 0), NULLIF(p.total, 0), $3, $3
		FROM unnest($4::text[], $5::date[], $6::bigint[], $7::text[], $8::text[], $9::text[], $10::int[], $11::int[], $12::text[])
			AS p (provider_id, posted_on, amount_cents, description, merchant_key, type, inst, total, category)
		LEFT JOIN finance_merchant_categories mc ON mc.user_id = $1 AND mc.merchant_key = p.merchant_key
		ON CONFLICT (source_id, provider_id) DO UPDATE SET
			posted_on = EXCLUDED.posted_on, amount_cents = EXCLUDED.amount_cents, description = EXCLUDED.description,
			merchant_key = EXCLUDED.merchant_key,
			installment_number = COALESCE(finance_transactions.installment_number, EXCLUDED.installment_number),
			total_installments = COALESCE(finance_transactions.total_installments, EXCLUDED.total_installments), updated_at = EXCLUDED.updated_at,
			type = finance_transactions.type,
			spending_category = CASE WHEN finance_transactions.category_set_by = 'fallback' AND finance_transactions.type_set_by = 'auto'
				AND EXCLUDED.type = 'expense' THEN EXCLUDED.spending_category ELSE finance_transactions.spending_category END,
			category_set_by = CASE WHEN finance_transactions.category_set_by = 'fallback' AND finance_transactions.type_set_by = 'auto'
				AND EXCLUDED.type = 'expense' THEN EXCLUDED.category_set_by ELSE finance_transactions.category_set_by END`,
		userID, sourceID, now, ids, days, cents, descs, keys, types, inst, total, cats)
	return err
}

// transactionColumns reads a Transaction as TransactionResponse, with its
// Source's name, then what CountsOn needs.
const transactionColumns = `t.id, t.posted_on::text, t.description, COALESCE(s.display_name, s.name), t.amount_cents, t.currency, t.type,
	t.spending_category, t.type_set_by, t.category_set_by, t.installment_number, t.total_installments,
	t.posted_on, s.kind, COALESCE(s.bill_close_day, 0), COALESCE(s.bill_due_day, 0)`

// scanTransaction reads transactionColumns and sets CountsOn.
func scanTransaction(r pgx.Row) (TransactionResponse, time.Time, error) {
	var t TransactionResponse
	var n, total *int
	var posted time.Time
	var kind Kind
	var closeDay, dueDay int
	err := r.Scan(&t.ID, &t.PostedOn, &t.Description, &t.SourceName, &t.AmountCents, &t.Currency, &t.Type,
		&t.SpendingCategory, &t.TypeSetBy, &t.CategorySetBy, &n, &total, &posted, &kind, &closeDay, &dueDay)
	if n != nil && total != nil {
		t.Installment = &InstallmentResponse{Number: *n, Total: *total}
	}
	on := CountsOn(posted, kind, closeDay, dueDay)
	t.CountsOn = on.Format(time.DateOnly)
	return t, on, err
}

// billLead is how far before its CountsOn a card charge can post: a charge on
// the closing day goes to next month's closing, and the due date can be the
// month after that.
const billLead = 2

// MonthTransactions returns the User's Transactions that count in [from, to)
// (CountsOn), newest posted first.
func (s *Store) MonthTransactions(ctx context.Context, userID string, from, to time.Time) ([]TransactionResponse, error) {
	rows, err := s.db.Query(ctx, `SELECT `+transactionColumns+`
		FROM finance_transactions t JOIN finance_sources s ON s.id = t.source_id
		WHERE t.user_id = $1 AND t.posted_on >= $2 AND t.posted_on < $3
		ORDER BY t.posted_on DESC, t.id`, userID, from.AddDate(0, -billLead, 0), to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TransactionResponse{}
	for rows.Next() {
		t, on, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		if !on.Before(from) && on.Before(to) {
			out = append(out, t)
		}
	}
	return out, rows.Err()
}

// SpendRows returns what the daily pace, the commitments outlook and the savings suggestion read of the
// User's Transactions that count in [from, to): Source, signed amount, type and
// category, with PostedOn set to the CountsOn day (Posted keeps the posted day) and Linked set when a Bill
// payment (not undone) points at it.
func (s *Store) SpendRows(ctx context.Context, userID string, from, to time.Time) ([]Txn, error) {
	rows, err := s.db.Query(ctx, `SELECT t.posted_on, t.amount_cents, t.type, t.spending_category, t.source_id,
			s.kind, COALESCE(s.bill_close_day, 0), COALESCE(s.bill_due_day, 0),
			EXISTS (SELECT 1 FROM finance_bill_payments p WHERE p.transaction_id = t.id AND p.undone_at IS NULL)
		FROM finance_transactions t JOIN finance_sources s ON s.id = t.source_id
		WHERE t.user_id = $1 AND t.posted_on >= $2 AND t.posted_on < $3`, userID, from.AddDate(0, -billLead, 0), to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Txn
	for rows.Next() {
		var t Txn
		var category *string
		var kind Kind
		var closeDay, dueDay int
		if err := rows.Scan(&t.PostedOn, &t.AmountCents, &t.Type, &category, &t.SourceID, &kind, &closeDay, &dueDay, &t.Linked); err != nil {
			return nil, err
		}
		t.Posted = t.PostedOn
		if t.PostedOn = CountsOn(t.PostedOn, kind, closeDay, dueDay); t.PostedOn.Before(from) || !t.PostedOn.Before(to) {
			continue
		}
		if category != nil {
			t.Category = *category
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ErrCategoryNeedsExpense is a category sent for a Transaction that is not, or
// does not become, an Expense.
var ErrCategoryNeedsExpense = errors.New("category needs expense")

// UpdateTransaction applies the User's edit in one database transaction. found
// is false when the row is not the User's. typ and category are nil when absent.
//
// Setting a category on a merchant saves the correction and files the User's
// other Expenses of that merchant, except those the User set, under it as 'auto'.
func (s *Store) UpdateTransaction(ctx context.Context, userID, id string, typ, category *string, now time.Time) (out TransactionResponse, found bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return out, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	var curType, merchant string
	var curCat, curBy *string
	err = tx.QueryRow(ctx, `SELECT type, spending_category, category_set_by, merchant_key FROM finance_transactions
		WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID).Scan(&curType, &curCat, &curBy, &merchant)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, false, nil
	} else if err != nil {
		return out, false, err
	}
	newType := curType
	if typ != nil {
		newType = *typ
	}
	var newCat, by *string
	switch {
	case newType != "expense" && category != nil:
		return out, true, ErrCategoryNeedsExpense
	case newType != "expense":
	case category != nil:
		newCat, by = category, ptr("user")
	case curCat != nil:
		newCat, by = curCat, curBy
	default:
		newCat, by = ptr("other"), ptr("fallback")
	}
	if _, err = tx.Exec(ctx, `
		UPDATE finance_transactions SET type = $3, type_set_by = CASE WHEN $4 THEN 'user' ELSE type_set_by END,
			spending_category = $5, category_set_by = $6, updated_at = $7
		WHERE id = $1 AND user_id = $2`, id, userID, newType, typ != nil, newCat, by, now); err != nil {
		return out, true, err
	}
	if category != nil && merchant != "" {
		if _, err = tx.Exec(ctx, `
			INSERT INTO finance_merchant_categories (user_id, merchant_key, spending_category, updated_at) VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, merchant_key) DO UPDATE SET spending_category = $3, updated_at = $4`,
			userID, merchant, *category, now); err != nil {
			return out, true, err
		}
		if _, err = tx.Exec(ctx, `
			UPDATE finance_transactions SET spending_category = $3, category_set_by = 'auto', updated_at = $4
			WHERE user_id = $1 AND merchant_key = $2 AND type = 'expense' AND id <> $5 AND category_set_by IS DISTINCT FROM 'user'`,
			userID, merchant, *category, now, id); err != nil {
			return out, true, err
		}
	}
	out, _, err = scanTransaction(tx.QueryRow(ctx, `SELECT `+transactionColumns+`
		FROM finance_transactions t JOIN finance_sources s ON s.id = t.source_id WHERE t.id = $1`, id))
	if err != nil {
		return out, true, err
	}
	return out, true, tx.Commit(ctx)
}

func ptr(s string) *string { return &s }

// InstallmentPlans returns the latest seen charge of each of the User's
// Installment plans, a plan being the same Source, merchant, total and start
// month (the month the charge counts in, CountsOn, minus n-1 months). Grouping
// keeps the repeated charges of a plan from counting twice, and a centavo of
// rounding between them keeps it one plan. It is done here, not in SQL, because
// the bill month needs CountsOn: card charges post on different days, so the
// posted month alone would split one plan in two. shortcut: a card without bill
// days still counts on posted_on, so its drift remains, until the Resident sets them.
func (s *Store) InstallmentPlans(ctx context.Context, userID string) ([]Plan, error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.description, t.merchant_key, t.installment_number, t.total_installments, -t.amount_cents, t.posted_on,
			t.source_id, s.kind, COALESCE(s.bill_close_day, 0), COALESCE(s.bill_due_day, 0), COALESCE(t.spending_category, '')
		FROM finance_transactions t JOIN finance_sources s ON s.id = t.source_id
		WHERE t.user_id = $1 AND t.type = 'expense' AND t.amount_cents < 0 AND t.installment_number IS NOT NULL
		ORDER BY t.installment_number DESC, t.posted_on DESC, t.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type planKey struct {
		source, merchant string
		total, start     int
	}
	seen := map[planKey]bool{}
	var out []Plan
	for rows.Next() {
		var p Plan
		var desc, key string
		var posted time.Time
		var kind Kind
		var closeDay, dueDay int
		if err := rows.Scan(&desc, &key, &p.Number, &p.Total, &p.AmountCents, &posted, &p.SourceID, &kind, &closeDay, &dueDay, &p.Category); err != nil {
			return nil, err
		}
		// A card installment is projected from the month its bill is due, as spending counts it.
		on := CountsOn(posted, kind, closeDay, dueDay)
		k := planKey{p.SourceID, key, p.Total, monthIndex(on) - (p.Number - 1)}
		if seen[k] { // rows come highest number first, so the first of a plan is its latest
			continue
		}
		seen[k] = true
		p.Name = PlanName(desc, key, p.Number, p.Total)
		p.Card = kind == "credit_card"
		p.Month = time.Date(on.Year(), on.Month(), 1, 0, 0, 0, 0, time.UTC)
		out = append(out, p)
	}
	return out, rows.Err()
}

// CardSources lists the User's credit card Sources, with whether both bill days
// are set and the bills the bank reported for each.
func (s *Store) CardSources(ctx context.Context, userID string) ([]Card, error) {
	rows, err := s.db.Query(ctx, `SELECT id, COALESCE(display_name, name) AS shown, bill_close_day IS NOT NULL AND bill_due_day IS NOT NULL
		FROM finance_sources WHERE user_id = $1 AND kind = 'credit_card' ORDER BY shown, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Card
	for rows.Next() {
		var c Card
		if err := rows.Scan(&c.ID, &c.Name, &c.BillDaysKnown); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	bills, err := s.db.Query(ctx, `SELECT source_id, closes_on, due_on, total_cents FROM finance_card_bills WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer bills.Close()
	for bills.Next() {
		var id string
		var b StoredBill
		if err := bills.Scan(&id, &b.ClosesOn, &b.DueOn, &b.TotalCents); err != nil {
			return nil, err
		}
		if i := slices.IndexFunc(out, func(c Card) bool { return c.ID == id }); i >= 0 {
			out[i].Bills = append(out[i].Bills, b)
		}
	}
	return out, bills.Err()
}

// FallbackUser is a User with Expenses nothing has categorised yet.
type FallbackUser struct{ ID, Email string }

// FallbackUsers lists the Users with an Expense still on 'fallback'.
func (s *Store) FallbackUsers(ctx context.Context) ([]FallbackUser, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.email FROM users u
		WHERE EXISTS (SELECT 1 FROM finance_transactions t WHERE t.user_id = u.id AND t.category_set_by = 'fallback')
		ORDER BY u.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FallbackUser
	for rows.Next() {
		var u FallbackUser
		if err := rows.Scan(&u.ID, &u.Email); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ApplyCorrections gives the User's saved corrections to their 'fallback'
// Expenses, so a correction saved after the import still wins over the model.
func (s *Store) ApplyCorrections(ctx context.Context, userID string, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		UPDATE finance_transactions t SET spending_category = c.spending_category, category_set_by = 'auto', updated_at = $2
		FROM finance_merchant_categories c
		WHERE t.user_id = $1 AND c.user_id = t.user_id AND c.merchant_key = t.merchant_key AND t.category_set_by = 'fallback'`,
		userID, now)
	return err
}

// FallbackMerchants returns the distinct merchant keys of the User's Expenses
// still on 'fallback', sorted.
func (s *Store) FallbackMerchants(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT merchant_key FROM finance_transactions
		WHERE user_id = $1 AND category_set_by = 'fallback' AND merchant_key <> '' ORDER BY merchant_key`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// SetCategories files the User's 'fallback' Expenses of each merchant key under
// its category, as decided by 'auto'. Rows the User or a rule decided meanwhile
// are left alone.
func (s *Store) SetCategories(ctx context.Context, userID string, keys, categories []string, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		UPDATE finance_transactions t SET spending_category = c.category, category_set_by = 'auto', updated_at = $4
		FROM unnest($2::text[], $3::text[]) AS c (merchant_key, category)
		WHERE t.user_id = $1 AND t.merchant_key = c.merchant_key AND t.category_set_by = 'fallback'`,
		userID, keys, categories, now)
	return err
}

// ReserveCategorizerCall takes one of the User's limit Categorizer calls for
// date and reports whether it got one. One statement inserts or increments, and
// the WHERE on the conflict update refuses at the limit, so concurrent runs can
// never pass it. Like dayplan's reserveLLMCall it runs on the pool: a call that
// was paid for is not given back.
func (s *Store) ReserveCategorizerCall(ctx context.Context, userID string, date time.Time, limit int) (bool, error) {
	var calls int
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_llm_calls (user_id, call_date, calls) VALUES ($1, $2, 1)
		ON CONFLICT (user_id, call_date) DO UPDATE SET calls = finance_llm_calls.calls + 1
		WHERE finance_llm_calls.calls < $3
		RETURNING calls`, userID, date, limit).Scan(&calls)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
