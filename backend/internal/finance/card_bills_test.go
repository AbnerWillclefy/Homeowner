package finance_test

import (
	"context"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

// The fixture's two bills: closing 24 Jul and 23 Jun 2023 (São Paulo days), due 31 Jul and 30 Jun.
func TestSyncStoresTheBanksCardBills(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)

	if n := scalar(t, app, `SELECT count(*) FROM finance_card_bills`); n != 2 {
		t.Fatalf("bills = %d, want the fixture's 2", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_card_bills b JOIN finance_sources s ON s.id = b.source_id
		WHERE s.pluggy_account_id = $1 AND b.user_id = s.user_id AND
		((b.provider_id = '0d474e08-cc45-4cc4-ada1-578a0646c6ce' AND b.closes_on = '2023-07-24' AND b.due_on = '2023-07-31' AND b.total_cents = 500000) OR
		 (b.provider_id = 'fb914966-a8c8-47ad-afab-2ff7c6720f9b' AND b.closes_on = '2023-06-23' AND b.due_on = '2023-06-30' AND b.total_cents = 300000))`,
		pluggytest.CardAccountID); n != 2 {
		t.Errorf("matching bills = %d, want both with the bank's dates and totals", n)
	}

	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_card_bills`); n != 2 {
		t.Errorf("bills after a second sync = %d, want 2", n)
	}
}

func TestSyncRestoresACorrectedBill(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_card_bills SET total_cents = 1, due_on = '2023-01-01', closes_on = '2023-01-01'`); err != nil {
		t.Fatal(err)
	}
	// Syncs are due a day after the last; the clock moves on.
	app.Clock.Set(afterFixtures.AddDate(0, 0, 2))
	app.RunFinanceSync(t)

	if n := scalar(t, app, `SELECT count(*) FROM finance_card_bills WHERE total_cents IN (500000, 300000) AND due_on IN ('2023-07-31', '2023-06-30') AND closes_on IN ('2023-07-24', '2023-06-23')`); n != 2 {
		t.Errorf("restored bills = %d, want 2", n)
	}
}

// A connector without /bills must not stop the import: the computed rule is the fallback.
func TestSyncFinishesWhenBillsFail(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.Pluggy.Fail("/bills", 500)
	sum := app.RunFinanceSync(t)

	if sum.Synced != 1 || sum.Failed != 0 {
		t.Errorf("summary = %+v, want the Item synced", sum)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_card_bills`); n != 0 {
		t.Errorf("bills = %d, want none", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d, want %d", n, fixtureRows)
	}
}

// Resumo shows the bank's total for a month whose bill the bank reported.
func TestOutlookTakesAStoredBillsTotal(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT user_id, id, 'march', '2027-03-03', '2027-03-10', 253090 FROM finance_sources WHERE kind = 'credit_card'`); err != nil {
		t.Fatal(err)
	}

	b, _ := readOutlook(t, ana)
	cards := b.Months[0].Cards
	if len(cards) != 1 || cards[0].AmountCents != 253090 {
		t.Fatalf("march cards = %+v, want the bank's 253090", cards)
	}
	if c := cards[0]; !c.FromBank || c.DueOn == nil || *c.DueOn != "2027-03-10" || c.ClosesOn == nil || *c.ClosesOn != "2027-03-03" {
		t.Errorf("march card = %+v, want fromBank with due 2027-03-10 and closes 2027-03-03", c)
	}
	if c := b.Months[1].Cards[0]; c.FromBank || c.DueOn != nil || c.ClosesOn != nil {
		t.Errorf("april card = %+v, want no bank bill", c)
	}
}
