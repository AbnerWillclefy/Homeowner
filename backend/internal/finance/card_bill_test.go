package finance_test

import (
	"context"
	"testing"
	"time"
)

// The fixture's card bill closes on the 7th and is due on the 12th, so a card
// charge counts on the 12th of its bill: before the 7th, this month's; from the
// 7th on, next month's.
func TestCardChargesCountInTheMonthTheirBillIsDue(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	insertTxn(t, app, "jan-20", "2028-01-20", -500, "pets")      // bill closing Feb 7, due Feb 12
	insertTxn(t, app, "feb-06", "2028-02-06", -10000, "housing") // bill closing Feb 7, due Feb 12
	insertTxn(t, app, "feb-07", "2028-02-07", -2000, "health")   // the closing day: next bill, due Mar 12

	if spent, cats, txns := readMonth(t, ana, "2028-02"); spent != 10500 || cats["pets"] != 500 || len(txns) != 2 {
		t.Errorf("february spent %d cats %v with %d rows, want 10500 with pets 500 in 2 rows", spent, cats, len(txns))
	}
	if spent, cats, txns := readMonth(t, ana, "2028-03"); spent != 2000 || cats["health"] != 2000 || len(txns) != 1 {
		t.Errorf("march spent %d cats %v with %d rows, want 2000 in health in 1 row", spent, cats, len(txns))
	}
	if spent, _, _ := readMonth(t, ana, "2028-01"); spent != 0 {
		t.Errorf("january spent %d, want 0: its charge is on February's bill", spent)
	}
	if _, ms := readHistory(t, ana, "?to=2028-03&months=2"); ms[0].SpentCents != 10500 || ms[1].SpentCents != 2000 {
		t.Errorf("history = %+v, want february 10500 and march 2000", ms)
	}

	app.Clock.Set(time.Date(2029, time.January, 1, 12, 0, 0, 0, time.UTC))
	// The whole bill lands on its due day.
	if d := readDaily(t, ana, "2028-02"); d.Current[10] != 0 || d.Current[11] != 10500 {
		t.Errorf("february daily = %v, want 0 on the 11th and 10500 from the 12th", d.Current)
	}
}

func TestSyncFillsEmptyCardBillDays(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_sources WHERE kind = 'credit_card' AND bill_close_day = 7 AND bill_due_day = 12`); n != 1 {
		t.Fatalf("card Sources with days 7 and 12 after connecting = %d, want 1", n)
	}
	// A Source connected before the days were kept has none until the next sync.
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET bill_close_day = NULL, bill_due_day = NULL`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Set(afterFixtures.Add(25 * time.Hour))
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_sources WHERE bill_close_day = 7 AND bill_due_day = 12`); n != 1 {
		t.Errorf("Sources with days 7 and 12 after the sync = %d, want only the card", n)
	}
}

// A card with only one day stored is not empty: the sync leaves it alone.
func TestSyncKeepsTypedBillDays(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ name, set string }{
		{"both typed", `bill_close_day = 3, bill_due_day = 10`},
		{"one typed", `bill_close_day = 3, bill_due_day = NULL`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, _ := startSync(t, []string{"ana@example.com"})
			app.RunFinanceSync(t)
			if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET `+tc.set+` WHERE kind = 'credit_card'`); err != nil {
				t.Fatal(err)
			}
			app.Clock.Set(afterFixtures.Add(25 * time.Hour))
			app.RunFinanceSync(t)
			if n := scalar(t, app, `SELECT count(*) FROM finance_sources WHERE bill_close_day = 3 AND bill_due_day IS NOT DISTINCT FROM (CASE WHEN bill_due_day = 10 THEN 10 END)`); n != 1 {
				t.Errorf("card days changed by the sync, want %s kept", tc.set)
			}
			if n := scalar(t, app, `SELECT count(*) FROM finance_sources WHERE bill_close_day = 7 OR bill_due_day = 12`); n != 0 {
				t.Errorf("Pluggy's days were stored over the typed ones")
			}
		})
	}
}

// An installment on the card is projected from its bill's month: posted on
// 20 January, part 3 is on February's bill, so part 4 falls in March.
func TestCardInstallmentsProjectFromTheirBillMonth(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	insertPlan(t, app, "ana@example.com", "tv3", "TV Loja PARC 03/10", "TV LOJA", "2028-01-20", -25000, 3, 10)

	b := readCommitments(t, users["ana@example.com"], "2028-02")
	if m := b.Months[0]; len(m.Installments) != 0 {
		t.Errorf("february = %+v, want nothing: part 3 is already its transaction", m)
	}
	if m := b.Months[1]; len(m.Installments) != 1 || m.Installments[0].AmountCents != 25000 || m.Installments[0].Number != 4 {
		t.Errorf("march = %+v, want TV Loja 4 of 10", m)
	}

	// Read from January, when part 3 is posted but its bill is not yet due: it is still to come, in February.
	b = readCommitments(t, users["ana@example.com"], "2028-01")
	if m := b.Months[1]; len(m.Installments) != 1 || m.Installments[0].AmountCents != 25000 || m.Installments[0].Number != 3 {
		t.Errorf("february from january = %+v, want TV Loja 3 of 10", m)
	}
	if m := b.Months[2]; len(m.Installments) != 1 || m.Installments[0].Number != 4 {
		t.Errorf("march from january = %+v, want TV Loja 4 of 10", m)
	}
}

// A bank posts each part on a slightly different day: part 11 on a closing day
// and part 12 a day before the next closing land on the same bill month, and
// must stay one plan, so the last part is not owed again.
func TestCardInstallmentsPostedAroundTheClosingStayOnePlan(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	insertPlan(t, app, "ana@example.com", "fee11", "ANUIDADE PARC 11/12", "ANUIDADE", "2028-01-07", -4375, 11, 12)
	insertPlan(t, app, "ana@example.com", "fee12", "ANUIDADE PARC 12/12", "ANUIDADE", "2028-02-06", -4375, 12, 12)

	b := readCommitments(t, users["ana@example.com"], "2028-03")
	for _, m := range b.Months {
		if len(m.Installments) != 0 {
			t.Errorf("%s = %+v, want nothing: part 12 of 12 is already charged", m.Month, m.Installments)
		}
	}
}
