package finance_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAHandPaymentKeepsTheExpectedAmountOfWhenItWasMade(t *testing.T) {
	t.Parallel()
	app, ana, bia := twoUsers(t)
	id := newBill(t, ana, "Rent", 10000, 5)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id, map[string]any{"name": "Rent", "expectedCents": 15000, "dueDay": 5}), http.StatusOK)

	nov, dec := listBills(t, ana, "2026-11")[0], listBills(t, ana, "2026-12")[0]
	if nov.ExpectedCents != 10000 || nov.PaidCents == nil || *nov.PaidCents != 10000 {
		t.Errorf("November = %+v, want expected and paid 10000", nov)
	}
	if dec.ExpectedCents != 15000 || dec.PaidCents != nil {
		t.Errorf("December = %+v, want expected 15000 and unpaid", dec)
	}
	if got := listBills(t, bia, "2026-11"); len(got) != 0 {
		t.Errorf("bia sees %+v", got)
	}

	// A payment from before the snapshot existed reads at the current amount.
	if _, err := app.DB.Exec(t.Context(), `UPDATE finance_bill_payments SET expected_cents = NULL`); err != nil {
		t.Fatal(err)
	}
	if got := listBills(t, ana, "2026-11")[0]; got.ExpectedCents != 15000 || *got.PaidCents != 15000 {
		t.Errorf("legacy payment = %+v, want 15000", got)
	}

	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+id+"/payments/2026-11"), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11")[0]; got.PaidCents != nil {
		t.Errorf("after undo paidCents = %d, want null", *got.PaidCents)
	}
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11")[0]; *got.PaidCents != 15000 {
		t.Errorf("repaid = %+v, want 15000", got)
	}
}

func TestABillIsListedOnlyFromTheMonthItWasCreated(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	app.Clock.Set(time.Date(2026, 11, 2, 1, 0, 0, 0, time.UTC)) // still 1 Nov in São Paulo
	newBill(t, ana, "Rent", 10000, 5)
	for month, want := range map[string]int{"2026-10": 0, "2026-11": 1, "2026-12": 1} {
		if got := listBills(t, ana, month); len(got) != want {
			t.Errorf("%s lists %d bills, want %d", month, len(got), want)
		}
	}
	app.Clock.Set(time.Date(2026, 12, 1, 1, 0, 0, 0, time.UTC)) // still 30 Nov in São Paulo
	newBill(t, ana, "Water", 5000, 5)
	if got := listBills(t, ana, "2026-11"); len(got) != 2 {
		t.Errorf("a Bill created on 30 Nov in São Paulo is missing from November: %+v", got)
	}
}

func TestABankPaymentReportsTheTransactionAmountAndSurvivesItsDeletion(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	id := newBill(t, ana, "Água", 8000, 10)
	addExpense(t, app, "PAGTO AGUA SABESP", 8000, "2026-11-06")
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(t.Context(), `UPDATE finance_transactions SET amount_cents = -8200 WHERE description = 'PAGTO AGUA SABESP'`); err != nil {
		t.Fatal(err)
	}

	got := listBills(t, ana, "2026-11")[0]
	if got.PaidCents == nil || *got.PaidCents != 8200 || got.ExpectedCents != 8000 {
		t.Fatalf("bank payment = %+v, want paid 8200 of 8000", got)
	}
	if _, err := app.DB.Exec(t.Context(), `DELETE FROM finance_transactions`); err != nil {
		t.Fatal(err)
	}
	if got := listBills(t, ana, "2026-11")[0]; got.PaidCents == nil || *got.PaidCents != 8000 {
		t.Errorf("after the Transaction is gone = %+v, want the snapshot 8000", got)
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+id+"/payments/2026-11"), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11")[0]; got.PaidCents != nil {
		t.Errorf("after undo = %+v, want unpaid", got)
	}
	// Paying the undone bank row by hand takes the Bill's current amount.
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id, map[string]any{"name": "Água", "expectedCents": 9000, "dueDay": 10}), http.StatusOK)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	got = listBills(t, ana, "2026-11")[0]
	if got.PaidBy == nil || *got.PaidBy != "hand" || got.ExpectedCents != 9000 || got.PaidCents == nil || *got.PaidCents != 9000 {
		t.Errorf("after repaying by hand = %+v, want hand, expected 9000 and paid 9000", got)
	}
}

func TestTheBankDoesNotPayAMonthBeforeTheBillExisted(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	newBill(t, users["ana@example.com"], "Água", 8000, 10) // created 8 Nov
	addExpense(t, app, "PAGTO AGUA SABESP", 8000, "2026-10-06")
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_payments`); n != 0 {
		t.Errorf("payments = %d, want 0", n)
	}
}
