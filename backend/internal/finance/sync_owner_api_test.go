package finance_test

import (
	"context"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"net/http"
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
	if _, err := app.DB.Exec(ctx, `UPDATE finance_transactions SET own_counterpart = false, type = 'expense', spending_category = 'other', category_set_by = 'auto' WHERE description = 'SYNTHETIC OWN NAME PIX'`); err != nil {
		t.Fatal(err)
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
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'SYNTHETIC OWN NAME PIX' AND own_counterpart AND type = 'transfer'`); n != 1 {
		t.Errorf("own-name Pix turned into a transfer by the re-import = %d, want 1", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = 'old-auto' AND type = 'transfer'`); n != 1 {
		t.Errorf("old auto PAGAMENTO ON LINE transfers = %d, want 1", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = 'old-user' AND type = 'expense' AND type_set_by = 'user'`); n != 1 {
		t.Errorf("user-set rows kept = %d, want 1", n)
	}
}

const partnerPix = "SYNTHETIC PARTNER PIX"

// otherPlanned is what the 'other' category still plans in the month, read from the commitments.
func otherPlanned(t *testing.T, c *apitest.Client) int64 {
	t.Helper()
	var body struct {
		Months []struct {
			Planned []struct {
				Category  string
				PaceCents int64
			}
		}
	}
	if err := decodeInto(c.Get("/me/finance/commitments?from=2026-04").Raw, &body); err != nil {
		t.Fatal(err)
	}
	for _, l := range body.Months[0].Planned {
		if l.Category == "other" {
			return l.PaceCents
		}
	}
	return 0
}

func importComplete(t *testing.T, app *apitest.App) int64 {
	return scalar(t, app, `SELECT count(*) FROM finance_items WHERE import_complete`)
}

func TestMarkingAPixRecipientTurnsItsPixIntoATransferOnTheNextSync(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	isType := func(typ string) int64 {
		return scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = $1 AND type = $2`, partnerPix, typ)
	}
	if isType("expense") != 1 {
		t.Fatal("setup: the partner Pix is not an expense without a recipient")
	}
	// The baseline reads the 3 months before the clock; January and March are in it in April.
	app.Clock.Set(time.Date(2026, 4, 15, 12, 0, 0, 0, time.UTC))
	withExpense := otherPlanned(t, ana)

	if n := importComplete(t, app); n == 0 {
		t.Fatal("setup: the import is not complete")
	}
	card := ana.Post("/me/finance/manual-cards", map[string]any{"name": "Fatura Naiara", "dueDay": 10, "pixRecipient": "  parceira SINTÉTICA "})
	apitest.ExpectStatus(t, card, http.StatusCreated)
	if n := importComplete(t, app); n != 0 {
		t.Errorf("complete imports after marking a recipient = %d, want the import restarted", n)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if isType("transfer") != 1 {
		t.Errorf("partner Pix transfers = %d, want 1", isType("transfer"))
	}
	if after := otherPlanned(t, ana); withExpense != 5061 || after != 617 {
		t.Errorf("planned for other: %d -> %d, want 5061 -> 617: the median of January 1234 and March 8888 (the Pix) becomes that of 1234 and 0", withExpense, after)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions t WHERE t::text ILIKE '%parceira%'`); n != 0 {
		t.Errorf("the recipient's name is stored in %d transaction rows", n)
	}

	// A save that keeps the recipient does not restart the import; changing or clearing it does.
	id := card.Body["id"].(string)
	same := map[string]any{"name": "Renamed", "dueDay": 11, "pixRecipient": "parceira SINTÉTICA", "bills": map[string]any{"2026-04": 5}}
	apitest.ExpectStatus(t, ana.Put("/me/finance/manual-cards/"+id, same), http.StatusOK)
	if n := importComplete(t, app); n == 0 {
		t.Error("a save with the same recipient restarted the import")
	}
	for name, recipient := range map[string]any{"changed": "Someone Else", "cleared": nil} {
		apitest.ExpectStatus(t, ana.Put("/me/finance/manual-cards/"+id, map[string]any{"name": "Renamed", "dueDay": 11, "pixRecipient": "Parceira Sintetica"}), http.StatusOK)
		app.Clock.Advance(25 * time.Hour)
		app.RunFinanceSync(t)
		body := map[string]any{"name": "Renamed", "dueDay": 11, "pixRecipient": recipient}
		apitest.ExpectStatus(t, ana.Put("/me/finance/manual-cards/"+id, body), http.StatusOK)
		if n := importComplete(t, app); n != 0 {
			t.Errorf("%s recipient: complete imports = %d, want the import restarted", name, n)
		}
	}
	// Deleting a card that has a recipient restarts the import; one without does not.
	apitest.ExpectStatus(t, ana.Put("/me/finance/manual-cards/"+id, map[string]any{"name": "Renamed", "dueDay": 11, "pixRecipient": "Parceira Sintetica"}), http.StatusOK)
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/manual-cards/"+id), http.StatusNoContent)
	if n := importComplete(t, app); n != 0 {
		t.Errorf("complete imports after deleting a card with a recipient = %d, want 0", n)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	plain := ana.Post("/me/finance/manual-cards", map[string]any{"name": "Plain", "dueDay": 1})
	apitest.ExpectStatus(t, ana.Delete("/me/finance/manual-cards/"+plain.Body["id"].(string)), http.StatusNoContent)
	if n := importComplete(t, app); n == 0 {
		t.Error("deleting a card with no recipient restarted the import")
	}
}

func TestAHandSetTypeSurvivesMarkingTheRecipient(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM finance_transactions WHERE description = $1`, partnerPix).Scan(&id); err != nil {
		t.Fatal(err)
	}
	patch := ana.Do(http.MethodPatch, "/me/finance/transactions/"+id, map[string]any{"type": "expense", "spendingCategory": "leisure"}, nil)
	apitest.ExpectStatus(t, patch, http.StatusOK)

	apitest.ExpectStatus(t, ana.Post("/me/finance/manual-cards", map[string]any{"name": "Fatura", "dueDay": 10, "pixRecipient": "Parceira Sintetica"}), http.StatusCreated)
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE id = $1 AND type = 'expense' AND type_set_by = 'user' AND spending_category = 'leisure'`, id); n != 1 {
		t.Errorf("hand-set rows kept = %d, want 1", n)
	}
}

// A recipient saved while a sync runs restarts the import; the run must not finish over it.
func TestARecipientSavedDuringASyncKeepsTheImportRestarted(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.Pluggy.OnFirstTransactions(func() {
		apitest.ExpectStatus(t, ana.Post("/me/finance/manual-cards", map[string]any{"name": "Fatura Naiara", "dueDay": 10, "pixRecipient": "parceira SINTÉTICA"}), http.StatusCreated)
	})
	app.RunFinanceSync(t)
	if n := importComplete(t, app); n != 0 {
		t.Errorf("complete imports after a recipient saved mid-run = %d, want 0", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_sources WHERE import_cursor IS NOT NULL`); n != 0 {
		t.Errorf("sources with a cursor = %d, want the restart kept", n)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = $1 AND type = 'transfer'`, partnerPix); n != 1 {
		t.Errorf("partner Pix transfers after the next run = %d, want 1", n)
	}
}
