package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type commitmentsBody struct {
	From   string
	Months []struct {
		Month          string
		CommittedCents int64
		Installments   []struct {
			Name          string
			Number, Total int
			AmountCents   int64
		}
		Bills []struct{ ExpectedCents int64 }
	}
}

// insertPlan stores one charge of a plan on a User's card, as a sync would.
func insertPlan(t *testing.T, app *apitest.App, email, provider, desc, key, day string, cents int64, n, total int) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT user_id, id, $2, $3::date, $4, 'BRL', $5, $6, 'expense', 'auto', 'other', 'fallback', $7, $8, now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = $1) LIMIT 1`,
		email, provider, day, cents, desc, key, n, total); err != nil {
		t.Fatal(err)
	}
}

func readCommitments(t *testing.T, c *apitest.Client, from string) commitmentsBody {
	t.Helper()
	res := c.Get("/me/finance/commitments?from=" + from)
	if res.Status != http.StatusOK {
		t.Fatalf("GET commitments %s = %d %s", from, res.Status, res.Raw)
	}
	var b commitmentsBody
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestCommitmentsProjectPlansMidwayAndEnding(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "ana@example.com", "p3", "TV Loja PARC 03/10", "TV LOJA", "2026-11-05", -25000, 3, 10)
	insertPlan(t, app, "ana@example.com", "p2", "TV Loja PARC 02/10", "TV LOJA", "2026-10-05", -25000, 2, 10) // an earlier charge of the same plan is not counted twice
	insertPlan(t, app, "ana@example.com", "e9", "Sofa PARC 09/10", "SOFA", "2026-11-10", -9000, 9, 10)
	insertPlan(t, app, "ana@example.com", "d6", "Bike PARC 06/06", "BIKE", "2026-11-02", -7000, 6, 6)

	b := readCommitments(t, ana, "2026-11")
	if b.From != "2026-11" || len(b.Months) != 12 || b.Months[0].Month != "2026-11" || b.Months[11].Month != "2027-10" {
		t.Fatalf("horizon = %+v, want 12 months 2026-11..2027-10", b)
	}
	if m := b.Months[0]; m.CommittedCents != 0 || len(m.Installments) != 0 {
		t.Errorf("the current month = %+v, want nothing: its charges are already transactions", m)
	}
	if m := b.Months[1]; m.CommittedCents != 25000+9000 || len(m.Installments) != 2 {
		t.Errorf("december = %+v, want TV 4 of 10 and Sofa 10 of 10", m)
	}
	if m := b.Months[2]; m.CommittedCents != 25000 || len(m.Installments) != 1 || m.Installments[0].Name != "TV Loja" || m.Installments[0].Number != 5 || m.Installments[0].Total != 10 {
		t.Errorf("january = %+v, want only TV Loja 5 of 10", m)
	}
	if m := b.Months[7]; m.CommittedCents != 25000 || m.Installments[0].Number != 10 {
		t.Errorf("june = %+v, want TV 10 of 10", m)
	}
	if m := b.Months[8]; m.CommittedCents != 0 || len(m.Installments) != 0 {
		t.Errorf("july = %+v, want the plan to have stopped", m)
	}
}

func TestCommitmentsCountARoundedPlanOnce(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "ana@example.com", "r1", "Loja PARC 01/03", "LOJA", "2026-09-05", -3334, 1, 3)
	insertPlan(t, app, "ana@example.com", "r2", "Loja PARC 02/03", "LOJA", "2026-10-05", -3333, 2, 3)

	m := readCommitments(t, ana, "2026-11").Months[0]
	if m.CommittedCents != 3333 || len(m.Installments) != 1 || m.Installments[0].Number != 3 {
		t.Errorf("november = %+v, want installment 3 once at 3333", m)
	}
}

func TestCommitmentsListUnpaidBillsOnly(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	rent := newBill(t, ana, "Rent", 150000, 5)
	newBill(t, ana, "Internet", 12000, 10)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+rent+"/payments/2026-11", nil), http.StatusNoContent)

	b := readCommitments(t, ana, "2026-11")
	if m := b.Months[0]; m.CommittedCents != 12000 || len(m.Bills) != 1 {
		t.Errorf("november = %+v, want only the unpaid Internet", m)
	}
	if m := b.Months[1]; m.CommittedCents != 162000 || len(m.Bills) != 2 {
		t.Errorf("december = %+v, want both Bills", m)
	}
}

func TestCommitmentsOfAUserWithNoInstallments(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	b := readCommitments(t, ana, "2026-11")
	if len(b.Months) != 12 {
		t.Fatalf("months = %d, want 12", len(b.Months))
	}
	for _, m := range b.Months {
		if m.CommittedCents != 0 || len(m.Installments) != 0 {
			t.Errorf("month %s = %+v, want zero", m.Month, m)
		}
	}
}

func TestCommitmentsNeverShowAnotherUsersPlans(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "bob@example.com", "b1", "Bob PARC 01/05", "BOB", "2026-11-05", -1000, 1, 5)

	for _, m := range readCommitments(t, ana, "2026-11").Months {
		if m.CommittedCents != 0 {
			t.Errorf("ana sees bob's plan in %+v", m)
		}
	}
}

func TestInvalidCommitmentsFromIs400(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	for _, v := range []string{"", "2026-13", "nope", "1999-12"} {
		if res := ana.Get("/me/finance/commitments?from=" + v); res.Status != http.StatusBadRequest {
			t.Errorf("from %q = %d, want 400", v, res.Status)
		}
	}
}

func TestResyncKeepsInstallmentValuesAlreadySet(t *testing.T) {
	t.Parallel()
	app, _ := seedMonth(t)
	q := `SELECT count(*) FROM finance_transactions WHERE installment_number = 2 AND total_installments = 6`
	if n := scalar(t, app, q); n == 0 {
		t.Fatal("no fixture row got the installment fields from its metadata")
	}
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_transactions SET installment_number = 1, total_installments = 7 WHERE installment_number = 2`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if n := scalar(t, app, q); n != 0 {
		t.Errorf("rows back at 2 of 6 = %d, want the values set before to stay", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE installment_number = 1 AND total_installments = 7`); n == 0 {
		t.Error("the values set before were overwritten by the re-sync")
	}
}

type outlookBody struct {
	Months []struct {
		Month          string
		CommittedCents int64
		Bills          []struct{ ExpectedCents int64 }
		Cards          []outlookCard
		OtherBills     []struct {
			ID, Name string
			Cents    int64
			Paid     bool
		}
		OtherInstallmentsCents int64
		TotalCents             int64
		LeftoverCents          *int64
		PercentOfIncome        *int64
	}
}

type outlookCard struct {
	SourceID, Name string
	AmountCents    int64
	BillDaysKnown  bool
}

// readOutlook also returns the raw months, to check a key is absent. It reads
// from 2027-03, after every row the sync fixture seeds.
func readOutlook(t *testing.T, c *apitest.Client) (outlookBody, []map[string]any) {
	t.Helper()
	res := c.Get("/me/finance/commitments?from=2027-03")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var b outlookBody
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	var raw struct{ Months []map[string]any }
	if err := json.Unmarshal(res.Raw, &raw); err != nil {
		t.Fatal(err)
	}
	return b, raw.Months
}

func TestCommitmentsCardBillAndLeftover(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	seedRow(t, app, "ana@example.com", "2027-03-10", "expense", -1000)
	seedRow(t, app, "ana@example.com", "2027-03-11", "expense", 300)   // a refund lowers the bill
	seedRow(t, app, "ana@example.com", "2027-03-12", "transfer", 5000) // a bill payment never counts
	insertPlan(t, app, "ana@example.com", "k3", "TV PARC 03/10", "TV", "2027-03-05", -2500, 3, 10)

	b, raw := readOutlook(t, ana)
	if _, has := raw[0]["leftoverCents"]; has {
		t.Errorf("leftoverCents present with no income: %v", raw[0])
	}
	m := b.Months[0]
	if len(m.Cards) != 1 || m.Cards[0].AmountCents != 1000-300+2500 || m.Cards[0].BillDaysKnown || m.Cards[0].SourceID == "" || m.Cards[0].Name == "" {
		t.Errorf("march cards = %+v, want one card at 3200 with unknown bill days", m.Cards)
	}
	if m.TotalCents != 3200 || m.CommittedCents != 0 || m.OtherInstallmentsCents != 0 || len(m.OtherBills) != 0 {
		t.Errorf("march = %+v, want total 3200 and the old committedCents (0)", m)
	}
	if a := b.Months[1]; len(a.Cards) != 1 || a.Cards[0].AmountCents != 2500 || a.TotalCents != 2500 || a.CommittedCents != 2500 {
		t.Errorf("april = %+v, want installment 4 as the card bill and as committedCents", a)
	}
	if z := b.Months[2]; z.Cards[0].AmountCents != 2500 {
		t.Errorf("may card = %+v, want installment 5", z.Cards)
	}

	apitest.ExpectStatus(t, putIncome(ana, 10000), http.StatusNoContent)
	b, _ = readOutlook(t, ana)
	if l := b.Months[0].LeftoverCents; l == nil || *l != 6800 {
		t.Errorf("march leftover = %v, want 6800", l)
	}
	if p := b.Months[0].PercentOfIncome; p == nil || *p != 0 {
		t.Errorf("march percentOfIncome = %v, want the unchanged 0", p)
	}
	apitest.ExpectStatus(t, putIncome(ana, 1000), http.StatusNoContent)
	if b, _ = readOutlook(t, ana); b.Months[0].LeftoverCents == nil || *b.Months[0].LeftoverCents != -2200 {
		t.Errorf("march leftover = %v, want -2200", b.Months[0].LeftoverCents)
	}
}

func TestCommitmentsCardWithBillDaysAndNothingToPay(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET bill_close_day = 7, bill_due_day = 12`); err != nil {
		t.Fatal(err)
	}
	b, _ := readOutlook(t, ana)
	if c := b.Months[0].Cards; len(c) != 1 || c[0].AmountCents != 0 || !c[0].BillDaysKnown {
		t.Errorf("cards = %+v, want a zero bill with known days", c)
	}
}

func TestCommitmentsListEveryBillAndLeaveOutThoseOnACard(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	rent := newBill(t, ana, "Rent", 150000, 5)
	newBill(t, ana, "Internet", 12000, 10)
	netflix := newBill(t, ana, "Netflix", 5000, 15)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+rent+"/payments/2027-03", nil), http.StatusNoContent)
	seedRow(t, app, "ana@example.com", "2027-03-15", "expense", -5000)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, transaction_id, paid_at)
		SELECT $1, user_id, '2027-03-01', 'bank', id, now() FROM finance_transactions WHERE posted_on = '2027-03-15'`, netflix); err != nil {
		t.Fatal(err)
	}

	b, _ := readOutlook(t, ana)
	m := b.Months[0]
	if len(m.OtherBills) != 2 || m.OtherBills[0].Name != "Rent" || !m.OtherBills[0].Paid || m.OtherBills[0].Cents != 150000 ||
		m.OtherBills[1].Name != "Internet" || m.OtherBills[1].Paid || m.OtherBills[1].Cents != 12000 {
		t.Errorf("march otherBills = %+v, want Rent paid and Internet unpaid, no Netflix", m.OtherBills)
	}
	if m.Cards[0].AmountCents != 5000 || m.TotalCents != 5000+150000+12000 {
		t.Errorf("march = %+v, want the Netflix charge in the card bill once", m)
	}
	if m.CommittedCents != 12000 || len(m.Bills) != 1 {
		t.Errorf("march committed = %d, bills = %+v, want the old unpaid-only values", m.CommittedCents, m.Bills)
	}
	if a := b.Months[1]; len(a.OtherBills) != 3 || a.TotalCents != 150000+12000+5000 {
		t.Errorf("april = %+v, want all three Bills: only the paid month of Netflix is left out", a)
	}
}

func TestCommitmentsKeepAPlanOnAnotherSourceAsItsOwnAmount(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "ana@example.com", "s1", "Sofa PARC 01/03", "SOFA", "2027-03-05", -900, 1, 3)
	if _, err := app.DB.Exec(context.Background(), `
		UPDATE finance_transactions SET source_id = (SELECT id FROM finance_sources WHERE kind <> 'credit_card' AND user_id = finance_transactions.user_id LIMIT 1)
		WHERE provider_id = 's1'`); err != nil {
		t.Fatal(err)
	}
	b, _ := readOutlook(t, ana)
	if a := b.Months[1]; a.OtherInstallmentsCents != 900 || a.TotalCents != 900 || a.Cards[0].AmountCents != 0 {
		t.Errorf("april = %+v, want the Sofa 2 of 3 in otherInstallmentsCents and total, not on the card", a)
	}
}
