package finance_test

import (
	"context"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func sourceOf(t *testing.T, c *apitest.Client, kind string) map[string]any {
	t.Helper()
	for _, s := range c.Get("/me/finance").Body["sources"].([]any) {
		if m := s.(map[string]any); m["kind"] == kind {
			return m
		}
	}
	t.Fatalf("no %s source", kind)
	return nil
}

func dueAgain(t *testing.T, app *apitest.App) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_items SET last_synced_at = last_synced_at - interval '2 days'`); err != nil {
		t.Fatal(err)
	}
}

func balanceRows(t *testing.T, app *apitest.App) int64 {
	return scalar(t, app, `SELECT count(*) FROM finance_source_balances`)
}

func TestSyncStoresBankAccountBalance(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	if s := sourceOf(t, ana, "checking"); s["balanceCents"] != nil || s["balanceOn"] != nil {
		t.Errorf("before any sync: %v, want no balance keys", s)
	}
	app.RunFinanceSync(t)
	if s := sourceOf(t, ana, "checking"); s["balanceCents"] != float64(4370143) || s["balanceOn"] != "2026-11-08" {
		t.Errorf("checking = %v, want balanceCents 4370143 on 2026-11-08", s)
	}
	card := sourceOf(t, ana, "credit_card")
	if _, ok := card["balanceCents"]; ok {
		t.Errorf("card has balanceCents: %v", card)
	}
	if _, ok := card["balanceOn"]; ok {
		t.Errorf("card has balanceOn: %v", card)
	}
	if n := balanceRows(t, app); n != 1 {
		t.Errorf("rows = %d, want 1 (no card row)", n)
	}
}

func TestSecondSyncSameDayReplacesBalance(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_source_balances SET balance_cents = 1`); err != nil {
		t.Fatal(err)
	}
	dueAgain(t, app)
	app.RunFinanceSync(t)
	if s := sourceOf(t, users["ana@example.com"], "checking"); s["balanceCents"] != float64(4370143) {
		t.Errorf("balance = %v, want replaced by 4370143", s["balanceCents"])
	}
	if n := balanceRows(t, app); n != 1 {
		t.Errorf("rows = %d, want 1", n)
	}
}

func TestNextDaySyncAddsRowAndHistoryCarriesForward(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	app.Clock.Set(afterFixtures.Add(48 * time.Hour))
	dueAgain(t, app)
	app.RunFinanceSync(t)
	if n := balanceRows(t, app); n != 2 {
		t.Errorf("rows = %d, want 2", n)
	}
	if s := sourceOf(t, users["ana@example.com"], "checking"); s["balanceOn"] != "2026-11-10" {
		t.Errorf("balanceOn = %v, want latest day 2026-11-10", s["balanceOn"])
	}
}

func TestNullBalanceKeepsPreviousAndImports(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	dueAgain(t, app)
	app.Pluggy.NullBalances()
	if sum := app.RunFinanceSync(t); sum.Synced != 1 {
		t.Errorf("summary = %+v, want Synced 1", sum)
	}
	if s := sourceOf(t, users["ana@example.com"], "checking"); s["balanceCents"] != float64(4370143) {
		t.Errorf("balance = %v, want previous kept", s["balanceCents"])
	}
}

func TestFailedAccountsKeepsPreviousBalance(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	dueAgain(t, app)
	app.Pluggy.Fail("/accounts", 500)
	app.RunFinanceSync(t)
	if s := sourceOf(t, users["ana@example.com"], "checking"); s["balanceCents"] != float64(4370143) {
		t.Errorf("balance = %v, want previous kept", s["balanceCents"])
	}
}

func TestNullBalanceBeforeFirstSyncStoresNothing(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.Pluggy.NullBalances()
	if sum := app.RunFinanceSync(t); sum.Synced != 1 {
		t.Errorf("summary = %+v, want Synced 1", sum)
	}
	if s := sourceOf(t, users["ana@example.com"], "checking"); s["balanceCents"] != nil {
		t.Errorf("balance = %v, want absent, not zero", s["balanceCents"])
	}
}

func TestBalanceHistoryReadsRangePlusLastBeforeAndNeverAnotherUsers(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	app.RunFinanceSync(t)
	id := sourceOf(t, users["ana@example.com"], "checking")["id"].(string)
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_source_balances SET day = '2026-11-08' WHERE source_id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := app.DB.Exec(context.Background(), `INSERT INTO finance_source_balances (user_id, source_id, day, balance_cents) VALUES ($1, $2, '2026-11-12', 500)`, userID(t, app, "ana@example.com"), id); err != nil {
		t.Fatal(err)
	}
	got, err := finance.NewStore(app.DB).BalanceHistory(context.Background(), userID(t, app, "ana@example.com"), day(time.November, 10), day(time.November, 14))
	if err != nil {
		t.Fatal(err)
	}
	want := []finance.Point[int64]{{Day: day(time.November, 8), Value: 4370143}, {Day: day(time.November, 12), Value: 500}}
	if len(got) != 1 || len(got[id]) != 2 || got[id][0] != want[0] || got[id][1] != want[1] {
		t.Errorf("read = %v, want only %s: %v", got, id, want)
	}
}
