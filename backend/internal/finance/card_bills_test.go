package finance_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"

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

// In the current month a closed bill counts the bank's total until a debit off
// the cards pays exactly that total; then the open bill counts instead.
func TestCurrentMonthTakesAClosedBillUntilItIsPaid(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	exec := func(q string) {
		t.Helper()
		if _, err := app.DB.Exec(context.Background(), q); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT user_id, id, 'nov', '2026-11-03', '2026-11-12', 123400 FROM finance_sources WHERE kind = 'credit_card'`)
	card := func() outlookCard {
		t.Helper()
		res := ana.Get("/me/finance/commitments?from=2026-11")
		apitest.ExpectStatus(t, res, http.StatusOK)
		var b outlookBody
		if err := json.Unmarshal(res.Raw, &b); err != nil || len(b.Months[0].Cards) != 1 {
			t.Fatalf("commitments = %s, %v", res.Raw, err)
		}
		return b.Months[0].Cards[0]
	}
	if c := card(); !c.FromBank || c.AmountCents != 123400 || !c.Closed || c.HeldTo == nil || *c.HeldTo != "2026-11-03" || c.HeldFrom == nil {
		t.Fatalf("unpaid = %+v, want the bank's 123400, closed, holding the charges up to its closing", c)
	}
	payment := func(cents int64, kind string) {
		t.Helper()
		exec(fmt.Sprintf(`INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, created_at, updated_at)
			SELECT user_id, id, gen_random_uuid()::text, '2026-11-07', %d, 'BRL', 'pagamento', 'PAGAMENTO', 'transfer', 'auto', now(), now()
			FROM finance_sources WHERE kind = '%s' LIMIT 1`, cents, kind))
	}
	payment(-123300, "checking") // another amount
	payment(-123400, "credit_card")
	if c := card(); !c.FromBank {
		t.Fatalf("after a different amount and a card row = %+v, want still the bank's bill", c)
	}
	payment(-123400, "checking")
	if c := card(); c.FromBank || c.Closed || c.HeldFrom == nil || *c.HeldFrom != "2026-11-03" || c.HeldTo != nil {
		t.Errorf("paid = %+v, want the open bill, holding the charges since the closing", c)
	}
}

// The month's numbers read one month of outlook, Resumo twelve: both must hold
// the open bill's charges that count on a later due day.
func TestMonthCommittedHoldsTheOpenBillLikeTheCommitments(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_card_bills;
		UPDATE finance_sources SET bill_close_day = 28, bill_due_day = 5 WHERE kind = 'credit_card'`); err != nil {
		t.Fatal(err)
	}
	seedRow(t, app, "ana@example.com", "2026-11-05", "expense", -777) // closes 2026-11-28, due 2026-12-05

	res := ana.Get("/me/finance/commitments?from=2026-11")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var b struct {
		Months []struct {
			Cards             []outlookCard
			SpentOffCardCents int64
		}
	}
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	want := b.Months[0].SpentOffCardCents
	for _, c := range b.Months[0].Cards {
		want += c.AmountCents
	}
	if committed, _ := readMonthNumbers(t, ana, "2026-11"); committed != want || b.Months[0].Cards[0].AmountCents < 777 {
		t.Errorf("committed = %d, want %d: the cards %+v with the open bill's 777", committed, want, b.Months[0].Cards)
	}
}
