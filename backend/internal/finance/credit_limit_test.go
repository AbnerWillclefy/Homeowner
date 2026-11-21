package finance_test

import (
	"context"
	"testing"
)

// The fixture card's creditLimit is 300000 reais.
const fixtureLimit = float64(30000000)

func TestSyncStoresACardsCreditLimit(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	if c := sourceOf(t, ana, "credit_card"); c["creditLimitCents"] != fixtureLimit {
		t.Errorf("connected card = %v, want creditLimitCents %v before any sync", c, fixtureLimit)
	}
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET credit_limit_cents = NULL`); err != nil {
		t.Fatal(err)
	}
	app.RunFinanceSync(t)
	if c := sourceOf(t, ana, "credit_card"); c["creditLimitCents"] != fixtureLimit {
		t.Errorf("synced card = %v, want creditLimitCents %v", c, fixtureLimit)
	}
	if c := sourceOf(t, ana, "checking"); c["creditLimitCents"] != nil {
		t.Errorf("checking = %v, want no creditLimitCents", c)
	}
}

func TestSyncWithoutALimitKeepsTheStoredOne(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	dueAgain(t, app)
	app.Pluggy.NullCreditLimits()
	app.RunFinanceSync(t)
	if c := sourceOf(t, users["ana@example.com"], "credit_card"); c["creditLimitCents"] != fixtureLimit {
		t.Errorf("card = %v, want the stored limit kept", c)
	}
}

func TestACardWithoutALimitOmitsTheKey(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET credit_limit_cents = NULL`); err != nil {
		t.Fatal(err)
	}
	app.Pluggy.NullCreditLimits()
	app.RunFinanceSync(t)
	if c := sourceOf(t, users["ana@example.com"], "credit_card"); c["creditLimitCents"] != nil {
		t.Errorf("card = %v, want no creditLimitCents key", c)
	}
}
