package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type historyMonth struct {
	Month      string
	SpentCents int64
	Categories []catBody
}

func (m historyMonth) cents(category string) int64 {
	for _, c := range m.Categories {
		if c.Category == category {
			return c.SpentCents
		}
	}
	return -1
}

// readHistory also checks that every month lists the 13 ids in the fixed order.
func readHistory(t *testing.T, c *apitest.Client, query string) (to string, months []historyMonth) {
	t.Helper()
	res := c.Get("/me/finance/history" + query)
	if res.Status != http.StatusOK {
		t.Fatalf("GET history %s = %d %s", query, res.Status, res.Raw)
	}
	var body struct {
		To     string
		Months []historyMonth
	}
	if err := json.Unmarshal(res.Raw, &body); err != nil {
		t.Fatal(err)
	}
	for _, m := range body.Months {
		if len(m.Categories) != len(finance.SpendingCategories) {
			t.Fatalf("%s has %d categories, want %d: %s", m.Month, len(m.Categories), len(finance.SpendingCategories), res.Raw)
		}
		for i, c := range m.Categories {
			if c.Category != finance.SpendingCategories[i] {
				t.Errorf("%s category %d = %s, want %s", m.Month, i, c.Category, finance.SpendingCategories[i])
			}
		}
	}
	return body.To, body.Months
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

func TestHistoryDefaultsToSixMonthsEndingThisMonth(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t) // the fake clock is 2026-11-08

	to, ms := readHistory(t, ana, "")
	if to != "2026-11" || len(ms) != 6 || ms[0].Month != "2026-06" || ms[5].Month != "2026-11" {
		t.Fatalf("to = %s, months = %+v, want 2026-06 to 2026-11", to, ms)
	}
	if nov := ms[5]; nov.SpentCents != 97780 || nov.cents("housing") != 80000 || nov.cents("groceries") != 0 {
		t.Errorf("november = %+v, want 97780 with housing 80000 and zero groceries", nov)
	}
	// 127270 and household_bills 30500 leave the 16770 transfer out.
	if oct := ms[4]; oct.SpentCents != 127270 || oct.cents("household_bills") != 30500 {
		t.Errorf("october = %+v, want 127270 with the transfer left out", oct)
	}
}

func TestHistoryWindowCrossesAYearWithZerosForEmptyMonths(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertTxn(t, app, "dec", "2025-12-31", -4200, "pets")

	to, ms := readHistory(t, ana, "?to=2026-02&months=4")
	if to != "2026-02" || len(ms) != 4 {
		t.Fatalf("to = %s, %d months, want 2026-02 and 4", to, len(ms))
	}
	for i, want := range []string{"2025-11", "2025-12", "2026-01", "2026-02"} {
		if ms[i].Month != want {
			t.Errorf("month %d = %s, want %s", i, ms[i].Month, want)
		}
	}
	if ms[1].cents("pets") != 4200 || ms[1].SpentCents != 4200 {
		t.Errorf("december = %+v, want pets 4200", ms[1])
	}
	for _, i := range []int{0, 2, 3} {
		if ms[i].SpentCents != 0 || ms[i].cents("pets") != 0 {
			t.Errorf("%s = %+v, want zeros", ms[i].Month, ms[i])
		}
	}
}

func TestHistoryRefundOffsetsAndCorrectedCategoryMoves(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertTxn(t, app, "refund", "2026-11-03", 3000, "housing")
	if _, ms := readHistory(t, ana, "?months=1"); ms[0].SpentCents != 94780 || ms[0].cents("housing") != 77000 {
		t.Errorf("november = %+v, want the refund to offset housing to 77000", ms[0])
	}

	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	if res := patch(ana, boleto.ID, map[string]string{"spendingCategory": "health"}); res.Status != http.StatusOK {
		t.Fatalf("patch = %d %s", res.Status, res.Raw)
	}
	if _, ms := readHistory(t, ana, "?months=1"); ms[0].cents("health") != 10000 || ms[0].cents("other") != 0 || ms[0].SpentCents != 94780 {
		t.Errorf("november = %+v, want 10000 moved from other to health", ms[0])
	}
}

func TestHistoryRejectsBadParametersAndOtherUsersRowsNeverCount(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	for _, q := range []string{"?months=0", "?months=13", "?months=abc", "?months="} {
		if res := ana.Get("/me/finance/history" + q); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid months" {
			t.Errorf("%s = %d %s, want 400 invalid months", q, res.Status, res.Raw)
		}
	}
	for _, q := range []string{"?to=", "?to=2026-13", "?to=nope", "?to=1999-12", "?to=2101-01"} {
		if res := ana.Get("/me/finance/history" + q); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid month" {
			t.Errorf("%s = %d %s, want 400 invalid month", q, res.Status, res.Raw)
		}
	}
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_transactions WHERE user_id = (SELECT id FROM users WHERE email = 'bob@example.com')`); err != nil {
		t.Fatal(err)
	}
	_, ms := readHistory(t, app.SignInAs("bob@example.com"), "")
	for _, m := range ms {
		if m.SpentCents != 0 {
			t.Errorf("bob sees %d in %s, want zeros", m.SpentCents, m.Month)
		}
	}
	if _, ms := readHistory(t, ana, ""); ms[5].SpentCents != 97780 {
		t.Errorf("ana november = %d, want 97780", ms[5].SpentCents)
	}
}

func TestReportIsGone(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	if res := ana.Get("/me/finance/report?month=2026-11"); res.Status != http.StatusNotFound {
		t.Errorf("GET report = %d, want 404", res.Status)
	}
}
