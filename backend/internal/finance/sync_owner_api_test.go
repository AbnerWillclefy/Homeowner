package finance_test

import (
	"context"
	"testing"
	"time"
)

func TestSyncMarksAnOwnNamePixAsATransferAndKeepsNothingOfTheReceiver(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'SYNTHETIC OWN NAME PIX' AND type = 'transfer' AND own_counterpart`); n != 1 {
		t.Errorf("own-name Pix transfers = %d, want 1", n)
	}
	// No column may hold the receiver's name or document.
	for _, secret := range []string{"Receiver Secret", "416.799.495", "41679949500"} {
		if n := scalar(t, app, `SELECT count(*) FROM finance_transactions t WHERE t::text ILIKE '%' || $1 || '%'`, secret); n != 0 {
			t.Errorf("%q is stored in %d rows", secret, n)
		}
	}
}

// After the 0042 reset the next syncs re-read the history: no duplicates, the
// User's choices stay, and an old auto expense with a bill wording is a Transfer.
func TestReimportAfterTheResetIsSafeTwice(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ctx := context.Background()
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT s.user_id, s.id, 'old-' || d.by, DATE '2026-01-13', -4200, 'BRL', 'PAGAMENTO ON LINE', 'PAGAMENTO ON LINE', 'expense', d.by, 'other', 'auto', now(), now()
		FROM finance_sources s, (VALUES ('auto'), ('user')) AS d (by)
		WHERE s.kind = 'checking'`); err != nil {
		t.Fatal(err)
	}
	reset := func() {
		if _, err := app.DB.Exec(ctx, `UPDATE finance_sources SET import_cursor = NULL; UPDATE finance_items SET import_complete = false`); err != nil {
			t.Fatal(err)
		}
	}
	reset()
	before := scalar(t, app, `SELECT count(*) FROM finance_transactions`)
	for range 2 {
		app.Clock.Advance(25 * time.Hour)
		app.RunFinanceSync(t)
		reset()
		app.Clock.Advance(25 * time.Hour)
		app.RunFinanceSync(t)
	}
	if after := scalar(t, app, `SELECT count(*) FROM finance_transactions`); after != before {
		t.Errorf("rows after the re-import = %d, want %d (no duplicates)", after, before)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = 'old-auto' AND type = 'transfer'`); n != 1 {
		t.Errorf("old auto PAGAMENTO ON LINE transfers = %d, want 1", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = 'old-user' AND type = 'expense' AND type_set_by = 'user'`); n != 1 {
		t.Errorf("user-set rows kept = %d, want 1", n)
	}
}
