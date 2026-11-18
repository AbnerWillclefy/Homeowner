package finance_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// insertParts stores parts nums of one purchase on Ana's card, part n posting n-1 months after start, as
// shopping the User set. It returns the provider ids by part.
func insertParts(t *testing.T, app *apitest.App, key string, start time.Time, cents int64, total int, nums ...int) map[int]string {
	t.Helper()
	ids := map[int]string{}
	for _, n := range nums {
		id := fmt.Sprintf("%s-%d", key, n)
		day := start.AddDate(0, n-1, 0).Format("2006-01-02")
		insertPlan(t, app, "ana@example.com", id, fmt.Sprintf("%s %d/%d", key, n, total), key, day, cents, n, total)
		ids[n] = id
	}
	setCategory(t, app, "shopping", "user", ids)
	return ids
}

func setCategory(t *testing.T, app *apitest.App, category, by string, ids map[int]string) {
	t.Helper()
	for _, id := range ids {
		if _, err := app.DB.Exec(context.Background(), `UPDATE finance_transactions SET spending_category = $1, category_set_by = $2 WHERE provider_id = $3`, category, by, id); err != nil {
			t.Fatal(err)
		}
	}
}

func rowID(t *testing.T, app *apitest.App, provider string) string {
	t.Helper()
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM finance_transactions WHERE provider_id = $1`, provider).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func categoryAndBy(t *testing.T, app *apitest.App, provider string) string {
	t.Helper()
	var c string
	if err := app.DB.QueryRow(context.Background(), `SELECT spending_category||'/'||category_set_by FROM finance_transactions WHERE provider_id = $1`, provider).Scan(&c); err != nil {
		t.Fatal(err)
	}
	return c
}

func TestACategoryOnOneInstallmentReachesTheWholePurchase(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	parts := insertParts(t, app, "SOLAR", time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC), -9000, 12, 1, 2, 3, 4, 5)
	// Edge rows of the purchase: a first part one centavo off, a part posted the last day of its month (start month one off).
	insertPlan(t, app, "ana@example.com", "cent", "SOLAR 1/12", "SOLAR", "2026-06-10", -9001, 1, 12)
	insertPlan(t, app, "ana@example.com", "close", "SOLAR 6/12", "SOLAR", "2026-10-31", -9000, 6, 12)
	// Outside the purchase, same merchant: another amount, a plan starting 2 months later, a charge that is no installment.
	insertPlan(t, app, "ana@example.com", "dearer", "SOLAR 1/12", "SOLAR", "2026-06-10", -9500, 1, 12)
	insertPlan(t, app, "ana@example.com", "late", "SOLAR 1/12", "SOLAR", "2026-08-10", -9000, 1, 12)
	insertTxn(t, app, "SOLAR", "2026-10-02", -1234, "leisure")
	setCategory(t, app, "shopping", "user", map[int]string{0: "cent", 1: "close", 2: "dearer"})
	setCategory(t, app, "leisure", "user", map[int]string{0: "late"})

	if res := patch(ana, rowID(t, app, parts[5]), map[string]string{"spendingCategory": "household_bills"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id IN ('SOLAR-1','SOLAR-2','SOLAR-3','SOLAR-4','SOLAR-5','cent','close')
		AND spending_category = 'household_bills' AND category_set_by = 'user'`); n != 7 {
		t.Errorf("parts of the purchase in household_bills/user = %d, want 7", n)
	}
	for id, want := range map[string]string{"dearer": "shopping/user", "late": "leisure/user", "SOLAR": "leisure/user"} {
		if got := categoryAndBy(t, app, id); got != want {
			t.Errorf("%s = %s, outside the purchase, want %s", id, got, want)
		}
	}
}

func TestAnInstallmentImportedLaterTakesThePurchaseCategory(t *testing.T) {
	t.Parallel()
	app, _ := seedMonth(t)
	ctx := context.Background()
	// The fixture's 2/6 card part is re-sent by the next sync once it is gone; part 1/6 is the User's.
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description, merchant_key, type, type_set_by,
			spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT user_id, source_id, 'sib1', posted_on - interval '1 month', amount_cents, currency, description, merchant_key, type, type_set_by,
			'household_bills', 'user', 1, total_installments, now(), now()
		FROM finance_transactions WHERE installment_number = 2 AND total_installments = 6
			AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`); err != nil {
		t.Fatal(err)
	}
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO finance_merchant_categories (user_id, merchant_key, spending_category, updated_at)
		SELECT user_id, merchant_key, 'leisure', now() FROM finance_transactions WHERE provider_id = 'sib1'
		ON CONFLICT (user_id, merchant_key) DO UPDATE SET spending_category = 'leisure'`); err != nil {
		t.Fatal(err)
	}
	if _, err := app.DB.Exec(ctx, `DELETE FROM finance_transactions WHERE installment_number = 2 AND total_installments = 6
			AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`); err != nil {
		t.Fatal(err)
	}
	// Read the whole year again: May is outside a refresh window.
	if _, err := app.DB.Exec(ctx, `UPDATE finance_sources SET import_cursor = NULL; UPDATE finance_items SET import_complete = false`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE installment_number = 2 AND total_installments = 6
		AND spending_category = 'household_bills' AND category_set_by = 'user'`); n != 1 {
		t.Errorf("re-imported 2/6 in household_bills/user = %d, want 1 (the purchase wins over the merchant correction)", n)
	}
}

func TestAPartTheUserMadeATransferStaysOneWhenThePurchaseIsCategorised(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	parts := insertParts(t, app, "SOLAR", time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC), -9000, 12, 1, 2, 3)
	if res := patch(ana, rowID(t, app, parts[1]), map[string]string{"type": "transfer"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if res := patch(ana, rowID(t, app, parts[3]), map[string]string{"spendingCategory": "household_bills"}); res.Status != http.StatusOK {
		t.Fatalf("PATCH = %d %s, want 200", res.Status, res.Raw)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = 'SOLAR-1' AND type = 'transfer' AND spending_category IS NULL`); n != 1 {
		t.Errorf("transfer part = %d rows, want it untouched", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id IN ('SOLAR-2','SOLAR-3') AND spending_category = 'household_bills'`); n != 2 {
		t.Errorf("expense parts moved = %d, want 2", n)
	}
}

func TestPlannedSpendingLeavesTheOldCategoryWhenAPurchaseMoves(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t) // the fake clock is 2026-11-08
	parts := insertParts(t, app, "SOLAR", time.Date(2026, 8, 5, 0, 0, 0, 0, time.UTC), -30000, 12, 1, 2, 3, 4)
	planned := func(m int, cat string) int64 {
		for _, p := range readPlanned(t, ana).Months[m].Planned {
			if p.Category == cat {
				return p.Cents
			}
		}
		return 0
	}
	shopping, household := planned(1, "shopping"), planned(1, "household_bills")
	if res := patch(ana, rowID(t, app, parts[4]), map[string]string{"spendingCategory": "household_bills"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	// Every part is one category, so the plan's remaining parts offset its own average: December plans what it did before the purchase moved.
	if got := planned(1, "shopping"); got != shopping {
		t.Errorf("december's shopping planned = %d, want %d: the purchase's parts no longer count in it", got, shopping)
	}
	if got := planned(1, "household_bills"); got != household {
		t.Errorf("december's household_bills planned = %d, want %d: the parts still to come offset its average", got, household)
	}
}
