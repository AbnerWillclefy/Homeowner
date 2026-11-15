package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type netWorthBody struct {
	HasData bool
	Today   *struct{ TotalCents, BalancesCents, InvestmentsCents, CardBillsCents int64 }
	Series  []struct {
		Day   string
		Cents int64
	}
	SeriesExcludesCardBills bool
	MonthStart              *struct {
		Day                             string
		BalancesCents, InvestmentsCents int64
	}
	MonthChange *struct{ BalancesCents, InvestmentsCents, TotalCents int64 }
}

func readNetWorth(t *testing.T, c *apitest.Client, query string) netWorthBody {
	t.Helper()
	res := c.Get("/me/finance/net-worth" + query)
	apitest.ExpectStatus(t, res, http.StatusOK)
	var b netWorthBody
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	return b
}

func exec(t *testing.T, app *apitest.App, q string, args ...any) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), q, args...); err != nil {
		t.Fatal(err)
	}
}

// netWorthFixture: the fixture checking account (43701.43), a second Source with
// 1000.00, the bank's Investments plus one typed by hand (500.00), and the
// card's bill of 1000.00 closed on 3 November 2026 and due on the 20th (today is the 8th).
func netWorthFixture(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	exec(t, app, `INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency)
		SELECT user_id, item_id, 'extra', 'savings', 'Extra', 'BRL' FROM finance_sources WHERE kind = 'checking'`)
	exec(t, app, `INSERT INTO finance_source_balances (user_id, source_id, day, balance_cents)
		SELECT user_id, id, '2026-11-08', 100000 FROM finance_sources WHERE pluggy_account_id = 'extra'`)
	newInvestment(t, ana, "CDB", 50000, "reserve")
	exec(t, app, `INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT user_id, id, 'nov', '2026-11-03', '2026-11-20', 100000 FROM finance_sources WHERE kind = 'credit_card'`)
	return app, ana
}

func TestNetWorthIsBalancesPlusInvestmentsMinusUnpaidCardBills(t *testing.T) {
	t.Parallel()
	_, ana := netWorthFixture(t)
	var invs int64
	for _, i := range savedInvestments(t, ana) { // the bank's, picked or not, and the typed one
		invs += int64(i["valueCents"].(float64))
	}
	got := readNetWorth(t, ana, "")
	if !got.HasData || got.Today == nil || !got.SeriesExcludesCardBills {
		t.Fatalf("net worth = %+v", got)
	}
	want := struct{ TotalCents, BalancesCents, InvestmentsCents, CardBillsCents int64 }{4370143 + 100000 + invs - 100000, 4470143, invs, 100000}
	if *got.Today != want || invs <= 50000 {
		t.Errorf("today = %+v, want %+v", *got.Today, want)
	}
}

func TestNetWorthIgnoresNonCardBills(t *testing.T) {
	t.Parallel()
	_, ana := netWorthFixture(t)
	before := readNetWorth(t, ana, "").Today
	newBill(t, ana, "Rent", 80000, 15)
	if after := readNetWorth(t, ana, "").Today; *after != *before {
		t.Errorf("after a Bill to pay = %+v, want %+v", *after, *before)
	}
}

func TestNetWorthDropsACardBillOnceItsDueDatePasses(t *testing.T) {
	t.Parallel()
	app, ana := netWorthFixture(t)
	app.Clock.Set(time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC))
	got := readNetWorth(t, ana, "").Today
	if got.CardBillsCents != 0 || got.TotalCents != got.BalancesCents+got.InvestmentsCents {
		t.Errorf("today = %+v, want no card bills", *got)
	}
}

func TestNetWorthSeriesHasOnePointPerDayFromTheFirstValue(t *testing.T) {
	t.Parallel()
	_, ana := netWorthFixture(t)
	for query, want := range map[string]int{"": 1, "?range=30d": 1, "?range=90d": 1, "?range=1y": 1} {
		if got := readNetWorth(t, ana, query).Series; len(got) != want || got[0].Day != "2026-11-08" {
			t.Errorf("series %q = %v, want %d point on 2026-11-08", query, got, want)
		}
	}
}

func TestNetWorthSeriesFillsEachDayOfTheRange(t *testing.T) {
	t.Parallel()
	app, ana := netWorthFixture(t)
	exec(t, app, `UPDATE finance_source_balances SET day = '2025-01-01'`)
	exec(t, app, `UPDATE finance_investment_values SET day = '2025-01-01'`)
	for query, want := range map[string]int{"": 30, "?range=30d": 30, "?range=90d": 90, "?range=1y": 365} {
		got := readNetWorth(t, ana, query).Series
		if len(got) != want || got[len(got)-1].Day != "2026-11-08" {
			t.Errorf("series %q has %d points, want %d ending 2026-11-08", query, len(got), want)
		}
	}
}

func TestNetWorthWithoutASyncedBalanceSaysThereIsNothingToShow(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	newInvestment(t, ana, "CDB", 50000, "reserve")
	res := ana.Get("/me/finance/net-worth")
	apitest.ExpectStatus(t, res, http.StatusOK)
	if res.Body["hasData"] != false || res.Body["today"] != nil || res.Body["monthStart"] != nil || res.Body["monthChange"] != nil {
		t.Errorf("body = %s, want hasData false and today null", res.Raw)
	}
	if s, ok := res.Body["series"].([]any); !ok || len(s) != 0 {
		t.Errorf("series = %v, want empty", res.Body["series"])
	}
}

func TestNetWorthRefusesAnUnknownRangeAndAUserOffTheAllowlist(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	apitest.ExpectStatus(t, ana.Get("/me/finance/net-worth?range=7d"), http.StatusBadRequest)
	apitest.ExpectStatus(t, app.SignInAs("eve@example.com").Get("/me/finance/net-worth"), http.StatusForbidden)
}

// balanceOn stores a balance for the fixture's checking account (today 43701.43; the second Source holds 1000.00).
func balanceOn(t *testing.T, app *apitest.App, day string, cents int64) {
	t.Helper()
	exec(t, app, `INSERT INTO finance_source_balances (user_id, source_id, day, balance_cents)
		SELECT user_id, id, $1, $2 FROM finance_sources WHERE kind = 'checking'`, day, cents)
}

func TestNetWorthChangeSinceTheMonthStart(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		now         time.Time
		seed        func(t *testing.T, app *apitest.App)
		query       string
		start       string
		balances    int64 // start balances
		investments int64 // start Investments, as a change from today's
		wantBalChg  int64
		wantInvChg  int64
	}{
		{name: "values before the month start: the last one counts", seed: func(t *testing.T, app *apitest.App) {
			balanceOn(t, app, "2026-10-25", 1)
			balanceOn(t, app, "2026-10-30", 4000000)
			balanceOn(t, app, "2026-11-03", 4200000)
		}, start: "2026-10-31", balances: 4000000 + 100000, wantBalChg: 4470143 - 4100000},
		{name: "a value exactly on the start day", seed: func(t *testing.T, app *apitest.App) {
			balanceOn(t, app, "2026-10-31", 4300000)
		}, start: "2026-10-31", balances: 4300000 + 100000, wantBalChg: 4470143 - 4400000},
		{name: "no value before the month start: the first of the month, change 0", seed: func(t *testing.T, app *apitest.App) {},
			start: "2026-10-31", balances: 4470143},
		{name: "an Investment created this month starts at its first value", seed: func(t *testing.T, app *apitest.App) {
			exec(t, app, `INSERT INTO finance_investment_values (investment_id, user_id, day, value_cents)
				SELECT id, user_id, '2026-11-02', 20000 FROM finance_investments WHERE name = 'CDB'`)
		}, start: "2026-10-31", balances: 4470143, wantInvChg: 30000},
		{name: "on the 1st the start is the previous month's last day", now: time.Date(2026, 12, 1, 12, 0, 0, 0, time.UTC), seed: func(t *testing.T, app *apitest.App) {
			balanceOn(t, app, "2026-11-30", 4000000)
			balanceOn(t, app, "2026-12-01", 4370143)
		}, start: "2026-11-30", balances: 4000000 + 100000, wantBalChg: 4470143 - 4100000},
		{name: "range=30d on the 31st does not reach the start day", now: time.Date(2026, 12, 31, 12, 0, 0, 0, time.UTC), query: "?range=30d", seed: func(t *testing.T, app *apitest.App) {
			balanceOn(t, app, "2026-11-30", 4000000)
			balanceOn(t, app, "2026-12-31", 4370143)
		}, start: "2026-11-30", balances: 4000000 + 100000, wantBalChg: 4470143 - 4100000},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana := netWorthFixture(t)
			if !tc.now.IsZero() {
				app.Clock.Set(tc.now)
			}
			tc.seed(t, app)
			got := readNetWorth(t, ana, tc.query)
			if got.MonthStart == nil || got.MonthChange == nil {
				t.Fatalf("net worth = %+v, want a month start", got)
			}
			invNow := got.Today.InvestmentsCents
			if got.MonthStart.Day != tc.start || got.MonthStart.BalancesCents != tc.balances || got.MonthStart.InvestmentsCents != invNow-tc.wantInvChg {
				t.Errorf("monthStart = %+v, want day %s balances %d investments %d", *got.MonthStart, tc.start, tc.balances, invNow-tc.wantInvChg)
			}
			want := struct{ BalancesCents, InvestmentsCents, TotalCents int64 }{tc.wantBalChg, tc.wantInvChg, tc.wantBalChg + tc.wantInvChg}
			if *got.MonthChange != want {
				t.Errorf("monthChange = %+v, want %+v", *got.MonthChange, want)
			}
		})
	}
}

func TestNetWorthChangeNeverCountsAnotherUsersValues(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	app.RunFinanceSync(t)
	exec(t, app, `INSERT INTO finance_source_balances (user_id, source_id, day, balance_cents)
		SELECT s.user_id, s.id, '2026-10-31', 99999999 FROM finance_sources s JOIN users u ON u.id = s.user_id WHERE u.email = 'bia@example.com' AND s.kind = 'checking'`)
	got := readNetWorth(t, users["ana@example.com"], "")
	if got.MonthChange == nil || got.MonthChange.BalancesCents != 0 {
		t.Errorf("monthChange = %+v, want 0 from ana's own values", got.MonthChange)
	}
}
