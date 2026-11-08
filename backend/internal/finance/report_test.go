package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type reportMonth struct {
	Month      string
	SpentCents int64
	Categories []catBody
}

func (m reportMonth) cents(category string) int64 {
	for _, c := range m.Categories {
		if c.Category == category {
			return c.SpentCents
		}
	}
	return -1
}

// readReport also checks that both months list the 13 ids in the fixed order.
func readReport(t *testing.T, c *apitest.Client, month string) (cur, prev reportMonth) {
	t.Helper()
	res := c.Get("/me/finance/report?month=" + month)
	if res.Status != http.StatusOK {
		t.Fatalf("GET report %s = %d %s", month, res.Status, res.Raw)
	}
	var body struct{ Month, Previous reportMonth }
	if err := json.Unmarshal(res.Raw, &body); err != nil {
		t.Fatal(err)
	}
	for _, m := range []reportMonth{body.Month, body.Previous} {
		if len(m.Categories) != len(finance.SpendingCategories) {
			t.Fatalf("%s has %d categories, want %d: %s", m.Month, len(m.Categories), len(finance.SpendingCategories), res.Raw)
		}
		for i, c := range m.Categories {
			if c.Category != finance.SpendingCategories[i] {
				t.Errorf("%s category %d = %s, want %s", m.Month, i, c.Category, finance.SpendingCategories[i])
			}
		}
	}
	return body.Month, body.Previous
}

// insertTxn adds an Expense of Ana's credit card Source, straight into the table.
func insertTxn(t *testing.T, app *apitest.App, id, day string, cents int64, category string) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, $1, $2::date, $3, 'BRL', $1, $1, 'expense', 'auto', $4, 'user', now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`,
		id, day, cents, category); err != nil {
		t.Fatal(err)
	}
}

func TestReportComparesTheMonthWithThePreviousOne(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)

	cur, prev := readReport(t, ana, "2026-11")
	if cur.Month != "2026-11" || cur.SpentCents != 97780 || cur.cents("housing") != 80000 || cur.cents("groceries") != 0 {
		t.Errorf("november = %+v, want 97780 with housing 80000 and zero groceries", cur)
	}
	// 127270 and household_bills 30500 leave the 16770 transfer out.
	if prev.Month != "2026-10" || prev.SpentCents != 127270 || prev.cents("household_bills") != 30500 {
		t.Errorf("october = %+v, want 127270 with the transfer left out", prev)
	}
}

func TestReportRefundOffsetsAndCorrectedCategoryMoves(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertTxn(t, app, "refund", "2026-11-03", 3000, "housing")
	if cur, _ := readReport(t, ana, "2026-11"); cur.SpentCents != 94780 || cur.cents("housing") != 77000 {
		t.Errorf("november = %+v, want the refund to offset housing to 77000", cur)
	}

	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	if res := patch(ana, boleto.ID, map[string]string{"spendingCategory": "health"}); res.Status != http.StatusOK {
		t.Fatalf("patch = %d %s", res.Status, res.Raw)
	}
	if cur, _ := readReport(t, ana, "2026-11"); cur.cents("health") != 10000 || cur.cents("other") != 0 || cur.SpentCents != 94780 {
		t.Errorf("november = %+v, want 10000 moved from other to health", cur)
	}
}

func TestReportMonthsWithNoDataAreZeros(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)

	// The first month has no previous data; a later one has none of its own.
	for _, tc := range []struct {
		month string
		empty func(cur, prev reportMonth) reportMonth
	}{
		{"2026-04", func(_, prev reportMonth) reportMonth { return prev }},
		{"2026-12", func(cur, _ reportMonth) reportMonth { return cur }},
	} {
		cur, prev := readReport(t, ana, tc.month)
		m := tc.empty(cur, prev)
		if m.SpentCents != 0 {
			t.Errorf("%s: empty month = %+v, want zeros", tc.month, m)
		}
		for _, c := range m.Categories {
			if c.SpentCents != 0 {
				t.Errorf("%s: %s = %d, want 0", tc.month, c.Category, c.SpentCents)
			}
		}
	}
	if _, prev := readReport(t, ana, "2027-03"); prev.Month != "2027-02" {
		t.Errorf("previous of 2027-03 = %s, want 2027-02", prev.Month)
	}
}

func TestReportJanuaryComparesWithDecember(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertTxn(t, app, "dec", "2025-12-31", -4200, "pets")

	cur, prev := readReport(t, ana, "2026-01")
	if cur.Month != "2026-01" || prev.Month != "2025-12" || prev.cents("pets") != 4200 || prev.SpentCents != 4200 {
		t.Errorf("january = %+v, previous = %+v, want December 2025 with pets 4200", cur, prev)
	}
}

func TestReportInvalidMonthIs400AndOtherUsersRowsNeverCount(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	for _, m := range []string{"", "2026-13", "nope", "1999-12", "2101-01"} {
		if res := ana.Get("/me/finance/report?month=" + m); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid month" {
			t.Errorf("month %q = %d %s, want 400 invalid month", m, res.Status, res.Raw)
		}
	}
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_transactions WHERE user_id = (SELECT id FROM users WHERE email = 'bob@example.com')`); err != nil {
		t.Fatal(err)
	}
	cur, prev := readReport(t, app.SignInAs("bob@example.com"), "2026-11")
	if cur.SpentCents != 0 || prev.SpentCents != 0 {
		t.Errorf("bob sees %d and %d, want zeros", cur.SpentCents, prev.SpentCents)
	}
	if cur, _ := readReport(t, ana, "2026-11"); cur.SpentCents != 97780 {
		t.Errorf("ana november = %d, want 97780", cur.SpentCents)
	}
}
