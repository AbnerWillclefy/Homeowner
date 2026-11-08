package finance_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// addExpense stores a posted Expense on the User's first Source, as a bank
// would show it. Its provider id is not in the fixtures, so a sync leaves it be.
func addExpense(t *testing.T, app *apitest.App, description string, cents int64, day string) {
	t.Helper()
	if _, err := app.DB.Exec(t.Context(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, 'match-' || $1::text, $3::date, -$2::bigint, 'BRL', $1, '', 'expense', 'auto', 'other', 'fallback', now(), now()
		FROM finance_sources ORDER BY id LIMIT 1`, description, cents, day); err != nil {
		t.Fatal(err)
	}
}

func paidBy(t *testing.T, c *apitest.Client, month string) string {
	t.Helper()
	got := listBills(t, c, month)
	if len(got) != 1 {
		t.Fatalf("bills = %+v", got)
	}
	if got[0].PaidBy == nil {
		return ""
	}
	return *got[0].PaidBy
}

func TestSyncPaysABillFromTheBankOnce(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	newBill(t, ana, "Água", 8000, 10)
	addExpense(t, app, "PAGTO AGUA SABESP", 8000, "2026-11-06")

	app.RunFinanceSync(t)
	if got := paidBy(t, ana, "2026-11"); got != "bank" {
		t.Fatalf("paidBy = %q, want bank", got)
	}
	if got := listBills(t, ana, "2026-10"); len(got) != 0 {
		t.Errorf("October lists %+v, want nothing before the Bill existed", got)
	}
	for range 2 {
		app.Clock.Advance(25 * time.Hour)
		app.RunFinanceSync(t)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_payments WHERE paid_by = 'bank' AND transaction_id IS NOT NULL`); n != 1 {
		t.Errorf("bank payments = %d, want 1", n)
	}
}

func TestSyncLeavesAHandPaidBillAlone(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	id := newBill(t, ana, "Água", 8000, 10)
	addExpense(t, app, "PAGTO AGUA SABESP", 8000, "2026-11-06")
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)

	app.RunFinanceSync(t)
	if got := paidBy(t, ana, "2026-11"); got != "hand" {
		t.Errorf("paidBy = %q, want hand", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_payments WHERE transaction_id IS NOT NULL`); n != 0 {
		t.Errorf("linked payments = %d, want 0", n)
	}
}

func TestAnAutomaticPaymentCanBeUndoneAndIsNotMatchedAgain(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	id := newBill(t, ana, "Água", 8000, 10)
	addExpense(t, app, "PAGTO AGUA SABESP", 8000, "2026-11-06")
	app.RunFinanceSync(t)
	pay := "/me/finance/bills/" + id + "/payments/2026-11"

	apitest.ExpectStatus(t, ana.Delete(pay), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11"); got[0].Paid || got[0].PaidBy != nil {
		t.Fatalf("after undo = %+v, want unpaid", got)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if got := listBills(t, ana, "2026-11"); got[0].Paid {
		t.Errorf("after re-sync = %+v, want still unpaid", got)
	}

	apitest.ExpectStatus(t, ana.Put(pay, nil), http.StatusNoContent)
	if got := paidBy(t, ana, "2026-11"); got != "hand" {
		t.Errorf("paidBy = %q, want hand", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_payments WHERE undone_at IS NOT NULL OR transaction_id IS NOT NULL`); n != 0 {
		t.Errorf("tombstone left on a hand payment: %d", n)
	}
}
