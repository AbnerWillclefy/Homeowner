package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func readMonthNumbers(t *testing.T, c *apitest.Client, month string) (committed, spent int64) {
	t.Helper()
	res := c.Get("/me/finance/transactions?month=" + month)
	apitest.ExpectStatus(t, res, http.StatusOK)
	var b struct{ CommittedCents, SpentSinceFirstCents int64 }
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	return b.CommittedCents, b.SpentSinceFirstCents
}

// seedChecking adds a row to the User's checking Source.
func seedChecking(t *testing.T, app *apitest.App, email, id, day, typ string, cents int64) {
	t.Helper()
	tag, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, $1, $2::date, $3, 'BRL', $1, $1, $4, 'auto',
			CASE WHEN $4 = 'expense' THEN 'groceries' END, 'user', now(), now()
		FROM finance_sources WHERE kind = 'checking' AND user_id = (SELECT id FROM users WHERE email = $5) LIMIT 1`,
		id, day, cents, typ, email)
	if err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("seed %s: %v", id, err)
	}
}

func setBillDays(t *testing.T, app *apitest.App) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET bill_close_day = 7, bill_due_day = 12 WHERE kind = 'credit_card'`); err != nil {
		t.Fatal(err)
	}
}

// The fake clock is 2026-11-08. The card closes on the 7th and is due on the 12th.
// Each case adds one row and checks how far the two numbers move.
func TestMonthCommittedAndSpentSinceTheFirst(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	setBillDays(t, app)
	c0, s0 := readMonthNumbers(t, ana, "2026-11")

	tests := []struct {
		name                string
		add                 func()
		wantCommit, wantSpt int64
	}{
		{"card purchase for next month's bill: spent only", func() { seedRow(t, app, "ana@example.com", "2026-11-10", "expense", -1000) }, 0, 1000},
		{"card purchase of last month on this month's bill: committed only", func() { seedRow(t, app, "ana@example.com", "2026-10-20", "expense", -2000) }, 2000, 0},
		{"Pix expense: both", func() { seedChecking(t, app, "ana@example.com", "pix", "2026-11-03", "expense", -3000) }, 3000, 3000},
		{"transfer: neither", func() { seedChecking(t, app, "ana@example.com", "tr", "2026-11-03", "transfer", -5000) }, 0, 0},
		{"saving: neither", func() { seedChecking(t, app, "ana@example.com", "sv", "2026-11-03", "saving", -6000) }, 0, 0},
		{"expense linked to a paid Bill: both", func() {
			seedChecking(t, app, "ana@example.com", "rent", "2026-11-04", "expense", -4000)
			if _, err := app.DB.Exec(context.Background(), `
				INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, transaction_id, paid_at, expected_cents)
				SELECT $1::uuid, user_id, '2026-11-01', 'bank', id, now(), 4000 FROM finance_transactions WHERE provider_id = 'rent'`,
				newBill(t, ana, "Aluguel", 4000, 10)); err != nil {
				t.Fatal(err)
			}
		}, 4000, 4000},
		{"refund nets off both", func() { seedChecking(t, app, "ana@example.com", "ref", "2026-11-05", "expense", 500) }, -500, -500},
	}
	for _, tc := range tests {
		tc.add()
		c1, s1 := readMonthNumbers(t, ana, "2026-11")
		if c1-c0 != tc.wantCommit || s1-s0 != tc.wantSpt {
			t.Errorf("%s: committed +%d spent +%d, want +%d and +%d", tc.name, c1-c0, s1-s0, tc.wantCommit, tc.wantSpt)
		}
		c0, s0 = c1, s1
	}
}

func TestMonthCommittedTakesTheBanksTotalForAStoredBill(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	setBillDays(t, app)
	// Only the one charge on the card, so the bill's charges are known.
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_transactions WHERE source_id IN (SELECT id FROM finance_sources WHERE kind = 'credit_card')`); err != nil {
		t.Fatal(err)
	}
	seedRow(t, app, "ana@example.com", "2026-10-20", "expense", -2000)
	c0, _ := readMonthNumbers(t, ana, "2026-11")
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT user_id, id, 'b1', '2026-11-07', '2026-11-12', 77700 FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`); err != nil {
		t.Fatal(err)
	}
	if c1, _ := readMonthNumbers(t, ana, "2026-11"); c1-c0 != 77700-2000 {
		t.Errorf("committed moved by %d, want %d: the bank's total replaces the charges", c1-c0, 77700-2000)
	}
}

func TestMonthNumbersPastAndFutureMonths(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	c0, s0 := readMonthNumbers(t, ana, "2026-09")
	seedChecking(t, app, "ana@example.com", "old", "2026-09-28", "expense", -1500)
	if c, s := readMonthNumbers(t, ana, "2026-09"); c-c0 != 1500 || s-s0 != 1500 {
		t.Errorf("september moved committed %d spent %d, want 1500 each: a past month covers the whole month", c-c0, s-s0)
	}
	if _, s := readMonthNumbers(t, ana, "2030-01"); s != 0 {
		t.Errorf("future spent = %d, want 0", s)
	}
}

func TestMonthNumbersIgnoreAnotherUsersRows(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	c0, s0 := readMonthNumbers(t, ana, "2026-11")
	seedChecking(t, app, "bob@example.com", "bobpix", "2026-11-03", "expense", -9000)
	seedRow(t, app, "bob@example.com", "2026-11-03", "expense", -9000)
	if c, s := readMonthNumbers(t, ana, "2026-11"); c != c0 || s != s0 {
		t.Errorf("committed %d spent %d, want %d and %d: Bob's rows never count", c, s, c0, s0)
	}
}
