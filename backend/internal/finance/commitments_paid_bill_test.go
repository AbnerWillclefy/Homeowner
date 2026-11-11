package finance_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestCommitmentsDoNotPlanLastMonthsPaidBill(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	apitest.ExpectStatus(t, ana.Put("/me/finance/income", map[string]int64{"monthlyIncomeCents": 5000000}), http.StatusNoContent)
	before := readPlanned(t, ana).Months[1].PlannedCents
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, 'rent', '2026-10-05', -150000, 'BRL', 'rent', 'rent', 'expense', 'auto', 'housing', 'user', now(), now()
		FROM finance_sources WHERE kind = 'checking' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com') LIMIT 1`); err != nil {
		t.Fatal(err)
	}
	// The fixture has rows in Aug, Sep and Oct, so 3 months are averaged and the 150000 adds 150000/3.
	if got := readPlanned(t, ana).Months[1].PlannedCents; got != before+50000 {
		t.Fatalf("unpaid rent expense planned = %d, want %d", got, before+50000)
	}
	bill := newBill(t, ana, "Aluguel", 150000, 10)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, transaction_id, paid_at, expected_cents)
		SELECT $1::uuid, user_id, '2026-10-01', 'bank', id, now(), 150000 FROM finance_transactions WHERE provider_id = 'rent'`, bill); err != nil {
		t.Fatal(err)
	}
	if got := readPlanned(t, ana).Months[1].PlannedCents; got != before {
		t.Errorf("planned = %d, want %d: the paid Bill is not planned again", got, before)
	}
}
