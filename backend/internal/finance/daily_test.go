package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// seedRow adds one Transaction to a User's credit card Source, straight into the
// table. amount is signed: negative is money out.
func seedRow(t *testing.T, app *apitest.App, email, day, typ string, amount int64) {
	t.Helper()
	tag, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, gen_random_uuid()::text, $1::date, $2, 'BRL', 'seed', 'SEED', $3, 'auto',
			CASE WHEN $3 = 'expense' THEN 'groceries' END, 'user', now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = $4)`,
		day, amount, typ, email)
	if err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("seed %s %s: %v (rows %d)", email, day, err, tag.RowsAffected())
	}
}

type dailyBody struct {
	Month         string
	Days          int
	Current       []int64
	Previous      []int64
	Average       []int64
	AverageMonths int
}

// readDaily also checks that no series is null.
func readDaily(t *testing.T, c *apitest.Client, month string) dailyBody {
	t.Helper()
	res := c.Get("/me/finance/daily?month=" + month)
	apitest.ExpectStatus(t, res, http.StatusOK)
	for _, k := range []string{"current", "previous", "average"} {
		if _, ok := res.Body[k].([]any); !ok {
			t.Fatalf("%s is not an array: %s", k, res.Raw)
		}
	}
	var out dailyBody
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// seedDaily gives Ana three months of history before 2027-03 and Bob rows that
// must never count. Today is 2027-03-15 in São Paulo. The sync's own rows sit in
// 2026-10 and 2026-11, so the tests stay clear of those months.
func seedDaily(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app, ana := seedMonth(t)
	app.Clock.Set(time.Date(2027, time.March, 15, 12, 0, 0, 0, time.UTC))
	for _, r := range []struct {
		day, typ string
		cents    int64
	}{
		{"2026-12-10", "expense", -1000},
		{"2027-01-31", "expense", -2000},
		{"2027-02-05", "transfer", -999}, // not spending
		{"2027-02-28", "expense", -600},
		{"2027-03-02", "expense", -500},
		{"2027-03-10", "expense", 200}, // a refund
		{"2027-03-12", "income", 7000},
		{"2027-03-16", "expense", -300}, // after today
	} {
		seedRow(t, app, "ana@example.com", r.day, r.typ, r.cents)
	}
	for _, day := range []string{"2026-12-01", "2027-02-01", "2027-03-01"} {
		seedRow(t, app, "bob@example.com", day, "expense", -9999)
	}
	return app, ana
}

func TestDailyCutsTheCurrentMonthAtToday(t *testing.T) {
	t.Parallel()
	_, ana := seedDaily(t)

	got := readDaily(t, ana, "2027-03")
	if got.Month != "2027-03" || got.Days != 31 || len(got.Current) != 15 {
		t.Fatalf("got month %q days %d current %d, want 2027-03, 31, 15", got.Month, got.Days, len(got.Current))
	}
	// day 1, 2, 9, 10 (after the refund), 15 (today); the expense of the 16th is absent
	if c := got.Current; c[0] != 0 || c[1] != 500 || c[8] != 500 || c[9] != 300 || c[14] != 300 {
		t.Errorf("current = %v", c)
	}
	// February, the month before: every day, the Transfer ignored
	if len(got.Previous) != 28 || got.Previous[27] != 600 || got.Previous[26] != 0 {
		t.Errorf("previous = %v", got.Previous)
	}
}

func TestDailyAveragesThreeMonthsAndAPastMonthIsFull(t *testing.T) {
	t.Parallel()
	_, ana := seedDaily(t)

	got := readDaily(t, ana, "2027-03")
	if got.AverageMonths != 3 || len(got.Average) != 31 {
		t.Fatalf("averageMonths %d, average %d long, want 3 and 31", got.AverageMonths, len(got.Average))
	}
	// day 10: (December 1000 + January 0 + February 0) / 3 = 333.33
	// day 29: February ends on day 28, so it counts its final 600: (1000 + 0 + 600) / 3 = 533.33
	// day 31: (1000 + 2000 + 600) / 3 = 1200
	if a := got.Average; a[0] != 0 || a[9] != 333 || a[28] != 533 || a[30] != 1200 {
		t.Errorf("average = %v", a)
	}

	feb := readDaily(t, ana, "2027-02")
	if feb.Days != 28 || len(feb.Current) != 28 || feb.Current[27] != 600 || feb.Current[26] != 0 {
		t.Errorf("february = %v (days %d), want 28 entries ending at 600", feb.Current, feb.Days)
	}
}

func TestDailyAveragesWhatHistoryExists(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	app.Clock.Set(time.Date(2027, time.March, 15, 12, 0, 0, 0, time.UTC))
	seedRow(t, app, "ana@example.com", "2031-05-03", "expense", -1001)

	none := readDaily(t, ana, "2030-06")
	if none.AverageMonths != 0 || none.Days != 30 || len(none.Average) != 0 || len(none.Current) != 0 {
		t.Errorf("no history: %+v, want no average and, as a future month, no current", none)
	}
	one := readDaily(t, ana, "2031-06")
	if one.AverageMonths != 1 || len(one.Average) != 30 || !slices.Equal(one.Average[:2], []int64{0, 0}) || one.Average[2] != 1001 || one.Average[29] != 1001 {
		t.Errorf("one month: %+v", one)
	}
}

func TestDailyShowsOnlyTheCallersRows(t *testing.T) {
	t.Parallel()
	app, _ := seedDaily(t)

	got := readDaily(t, app.SignInAs("bob@example.com"), "2027-03")
	// December and February have rows, January none
	if got.Current[0] != 9999 || got.Current[14] != 9999 || got.AverageMonths != 2 {
		t.Errorf("bob = %+v, want only his own 9999 and two months of history", got)
	}
}

func TestDailyNeedsTheFinanceAllowlist(t *testing.T) {
	t.Parallel()
	app, _, _ := twoUsers(t)
	if res := app.SignInAs("bob@example.com").Get("/me/finance/daily?month=2027-03"); res.Status != http.StatusForbidden {
		t.Errorf("GET = %d, want 403", res.Status)
	}
}

func TestDailyRejectsABadMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	for _, m := range []string{"", "2027-13", "March", "1999-12"} {
		if res := ana.Get("/me/finance/daily?month=" + m); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid month" {
			t.Errorf("month %q = %d %s, want 400 invalid month", m, res.Status, res.Raw)
		}
	}
}
