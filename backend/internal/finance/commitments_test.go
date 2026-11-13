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
		Month        string
		Installments []struct {
			Name          string
			Number, Total int
			AmountCents   int64
		}
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

func TestCommitmentsListAPlanOnceWhenItsChargesPostOnDriftingDays(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET bill_close_day = 7, bill_due_day = 12`); err != nil {
		t.Fatal(err)
	}
	// 1/12 posts after the closing day (bill of Jul), the rest before it (bills of Aug..Oct): posted months drift, bill months do not.
	insertPlan(t, app, "ana@example.com", "c1", "Canadian Solar Ecommer 1/12", "CANADIAN SOLAR ECOMMER", "2026-06-20", -10000, 1, 12)
	insertPlan(t, app, "ana@example.com", "c2", "Canadian Solar Ecommer 2/12", "CANADIAN SOLAR ECOMMER", "2026-08-03", -10000, 2, 12)
	insertPlan(t, app, "ana@example.com", "c3", "Canadian Solar Ecommer 3/12", "CANADIAN SOLAR ECOMMER", "2026-09-03", -10000, 3, 12)
	insertPlan(t, app, "ana@example.com", "c4", "Canadian Solar Ecommer 4/12", "CANADIAN SOLAR ECOMMER", "2026-10-03", -10000, 4, 12)

	b := readCommitments(t, ana, "2026-11")
	for i := range 3 {
		m := b.Months[i]
		if len(m.Installments) != 1 || m.Installments[0].Name != "Canadian Solar Ecommer" || m.Installments[0].Number != 5+i || m.Installments[0].Total != 12 {
			t.Errorf("%s = %+v, want the plan once as %d of 12", m.Month, m.Installments, 5+i)
		}
	}
}

func TestCommitmentsKeepTwoPlansOfTheSameMerchantAndTotalApart(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "ana@example.com", "a3", "Loja 3/12", "LOJA", "2026-10-05", -10000, 3, 12)
	insertPlan(t, app, "ana@example.com", "b1", "Loja 1/12", "LOJA", "2026-11-05", -20000, 1, 12)

	if m := readCommitments(t, ana, "2026-11").Months[1]; len(m.Installments) != 2 {
		t.Errorf("december = %+v, want both plans", m)
	}
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
	if m := b.Months[0]; len(m.Installments) != 0 {
		t.Errorf("the current month = %+v, want nothing: its charges are already transactions", m)
	}
	if m := b.Months[1]; len(m.Installments) != 2 || m.Installments[0].AmountCents+m.Installments[1].AmountCents != 25000+9000 {
		t.Errorf("december = %+v, want TV 4 of 10 and Sofa 10 of 10", m)
	}
	if m := b.Months[2]; len(m.Installments) != 1 || m.Installments[0].AmountCents != 25000 || m.Installments[0].Name != "TV Loja" || m.Installments[0].Number != 5 || m.Installments[0].Total != 10 {
		t.Errorf("january = %+v, want only TV Loja 5 of 10", m)
	}
	if m := b.Months[7]; len(m.Installments) != 1 || m.Installments[0].AmountCents != 25000 || m.Installments[0].Number != 10 {
		t.Errorf("june = %+v, want TV 10 of 10", m)
	}
	if m := b.Months[8]; len(m.Installments) != 0 {
		t.Errorf("july = %+v, want the plan to have stopped", m)
	}
}

func TestCommitmentsCountARoundedPlanOnce(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "ana@example.com", "r1", "Loja PARC 01/03", "LOJA", "2026-09-05", -3334, 1, 3)
	insertPlan(t, app, "ana@example.com", "r2", "Loja PARC 02/03", "LOJA", "2026-10-05", -3333, 2, 3)

	m := readCommitments(t, ana, "2026-11").Months[0]
	if len(m.Installments) != 1 || m.Installments[0].AmountCents != 3333 || m.Installments[0].Number != 3 {
		t.Errorf("november = %+v, want installment 3 once at 3333", m)
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
		if len(m.Installments) != 0 {
			t.Errorf("month %s = %+v, want zero", m.Month, m)
		}
	}
}

func TestCommitmentsNeverShowAnotherUsersPlans(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	insertPlan(t, app, "bob@example.com", "b1", "Bob PARC 01/05", "BOB", "2026-11-05", -1000, 1, 5)

	for _, m := range readCommitments(t, ana, "2026-11").Months {
		if len(m.Installments) != 0 {
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
		Month      string
		Cards      []outlookCard
		OtherBills []struct {
			ID, Name string
			Cents    int64
			Paid     bool
		}
		OtherInstallmentsCents  int64
		TotalCents, SavingCents int64
		LeftoverCents           *int64
	}
}

type outlookCard struct {
	SourceID, Name  string
	AmountCents     int64
	BillDaysKnown   bool
	FromBank        bool
	DueOn, ClosesOn *string
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

// fixturePlanned is what the sync fixture's August, September and October spend
// (the 3 months before the fake clock, averaged per category: 53333 + 30500 + 5993
// + 5187) plans in every month from 2027-03, where no counted row has a category.
const fixturePlanned = 95013

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
	if m.TotalCents != 3200+fixturePlanned || m.OtherInstallmentsCents != 0 || len(m.OtherBills) != 0 {
		t.Errorf("march = %+v, want total 3200 plus the planned spending", m)
	}
	if a := b.Months[1]; len(a.Cards) != 1 || a.Cards[0].AmountCents != 2500 || a.TotalCents != 2500+fixturePlanned {
		t.Errorf("april = %+v, want installment 4 as the card bill", a)
	}
	if c := m.Cards[0]; c.FromBank || c.DueOn != nil || c.ClosesOn != nil {
		t.Errorf("march card = %+v, want no bank bill", c)
	}
	if z := b.Months[2]; z.Cards[0].AmountCents != 2500 {
		t.Errorf("may card = %+v, want installment 5", z.Cards)
	}

	apitest.ExpectStatus(t, putIncome(ana, 10000), http.StatusNoContent)
	b, _ = readOutlook(t, ana)
	if l := b.Months[0].LeftoverCents; l == nil || *l != 6800-fixturePlanned {
		t.Errorf("march leftover = %v, want %d", l, 6800-fixturePlanned)
	}
	apitest.ExpectStatus(t, putIncome(ana, 1000), http.StatusNoContent)
	if b, _ = readOutlook(t, ana); b.Months[0].LeftoverCents == nil || *b.Months[0].LeftoverCents != -2200-fixturePlanned {
		t.Errorf("march leftover = %v, want %d", b.Months[0].LeftoverCents, -2200-fixturePlanned)
	}

	// The Monthly contribution is put aside, and the leftover subtracts it.
	apitest.ExpectStatus(t, putContribution(ana, 4000, 50), http.StatusNoContent)
	b, _ = readOutlook(t, ana)
	if m := b.Months[0]; m.SavingCents != 4000 || m.TotalCents != 3200+fixturePlanned+4000 || m.LeftoverCents == nil || *m.LeftoverCents != 1000-3200-fixturePlanned-4000 {
		t.Errorf("march = %+v, want savingCents 4000 in the total and the leftover", m)
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
	// The fixture pays VIVO 120.00 every month: the Internet Bill, so it leaves the planned average.
	planned := int64(fixturePlanned - 12000)
	if m.Cards[0].AmountCents != 5000 || m.TotalCents != 5000+150000+12000+planned {
		t.Errorf("march = %+v, want the Netflix charge in the card bill once", m)
	}
	if a := b.Months[1]; len(a.OtherBills) != 3 || a.TotalCents != 150000+12000+5000+planned {
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
	if a := b.Months[1]; a.OtherInstallmentsCents != 900 || a.TotalCents != 900+fixturePlanned || a.Cards[0].AmountCents != 0 {
		t.Errorf("april = %+v, want the Sofa 2 of 3 in otherInstallmentsCents and total, not on the card", a)
	}
}

type paceMonth struct {
	Month               string
	LeftoverCents       *int64
	DailyAllowanceCents *int64
	Pace                *struct {
		SpentCents   []int64
		LineEndCents int64
	}
}

// readPace reads the outlook from 2027-03 with the clock at `now`, both the typed
// months and the raw ones (to check a key is absent, not zero).
func readPace(t *testing.T, app *apitest.App, c *apitest.Client, now time.Time) ([]paceMonth, []map[string]any) {
	t.Helper()
	app.Clock.Set(now)
	res := c.Get("/me/finance/commitments?from=2027-03")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var typed struct{ Months []paceMonth }
	var raw struct{ Months []map[string]any }
	if err := json.Unmarshal(res.Raw, &typed); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(res.Raw, &raw); err != nil {
		t.Fatal(err)
	}
	return typed.Months, raw.Months
}

func TestCommitmentsDailyAllowanceAndPaceOfTheCurrentMonth(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	seedRow(t, app, "ana@example.com", "2027-03-02", "expense", -1000)
	seedRow(t, app, "ana@example.com", "2027-03-03", "expense", -500)
	seedRow(t, app, "ana@example.com", "2027-03-03", "saving", -7000)   // left out of the spent line
	seedRow(t, app, "ana@example.com", "2027-03-03", "transfer", -7000) // so is a transfer
	apitest.ExpectStatus(t, putIncome(ana, 1_000_000), http.StatusNoContent)

	months, raw := readPace(t, app, ana, time.Date(2027, time.March, 3, 12, 0, 0, 0, time.UTC))
	m := months[0]
	if m.LeftoverCents == nil || m.DailyAllowanceCents == nil || m.Pace == nil {
		t.Fatalf("march = %+v, want the leftover, the daily allowance and the pace", m)
	}
	// March 3 leaves 29 days, today included.
	if want := (*m.LeftoverCents + 14) / 29; *m.DailyAllowanceCents < want-1 || *m.DailyAllowanceCents > want+1 {
		t.Errorf("dailyAllowanceCents = %d, want the leftover %d over 29 days", *m.DailyAllowanceCents, *m.LeftoverCents)
	}
	if got := m.Pace.SpentCents; len(got) != 3 || got[0] != 0 || got[1] != 1000 || got[2] != 1500 {
		t.Errorf("pace spentCents = %v, want [0 1000 1500]", got)
	}
	if want := 1_000_000 - *m.LeftoverCents; m.Pace.LineEndCents != want {
		t.Errorf("pace lineEndCents = %d, want income minus leftover %d", m.Pace.LineEndCents, want)
	}
	if raw[0]["totalCents"] != float64(m.Pace.LineEndCents) {
		t.Errorf("pace lineEndCents = %d, want the month's totalCents %v", m.Pace.LineEndCents, raw[0]["totalCents"])
	}
	for _, key := range []string{"month", "installments", "cards", "otherBills", "planned", "plannedCents", "savingCents", "totalCents", "leftoverCents"} {
		if _, has := raw[0][key]; !has {
			t.Errorf("march lost its %s key: %v", key, raw[0])
		}
	}
	for _, later := range months[1:] {
		if later.DailyAllowanceCents != nil || later.Pace != nil {
			t.Errorf("%s = %+v, want neither a daily allowance nor a pace in a future month", later.Month, later)
		}
	}
}

func TestCommitmentsWithoutIncomeHaveNoDailyAllowanceNorPace(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	seedRow(t, app, "ana@example.com", "2027-03-02", "expense", -1000)
	_, raw := readPace(t, app, ana, time.Date(2027, time.March, 3, 12, 0, 0, 0, time.UTC))
	for _, m := range raw {
		for _, key := range []string{"dailyAllowanceCents", "pace"} {
			if _, has := m[key]; has {
				t.Errorf("%v has %s with no income", m["month"], key)
			}
		}
	}
}

func TestCommitmentsDailyAllowanceIsTheWholeLeftoverOnTheLastSaoPauloDay(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 1_000_000), http.StatusNoContent)

	// 01:00 UTC on April 1 is still March 31 in São Paulo (UTC-3).
	months, _ := readPace(t, app, ana, time.Date(2027, time.April, 1, 1, 0, 0, 0, time.UTC))
	m := months[0]
	if m.DailyAllowanceCents == nil || *m.DailyAllowanceCents != *m.LeftoverCents {
		t.Errorf("march = %+v, want the full leftover as the daily allowance", m)
	}
	if m.Pace == nil || len(m.Pace.SpentCents) != 31 {
		t.Errorf("march pace = %+v, want all 31 days", m.Pace)
	}
	if a := months[1]; a.DailyAllowanceCents != nil || a.Pace != nil {
		t.Errorf("april = %+v, want nothing before it starts", a)
	}
}

func TestCommitmentsPastMonthHasPaceButNoDailyAllowance(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 1_000_000), http.StatusNoContent)
	months, _ := readPace(t, app, ana, time.Date(2027, time.April, 10, 12, 0, 0, 0, time.UTC))
	if m := months[0]; m.DailyAllowanceCents != nil || m.Pace == nil || len(m.Pace.SpentCents) != 31 {
		t.Errorf("march = %+v, want the whole month's pace and no daily allowance", m)
	}
	if a := months[1]; a.DailyAllowanceCents == nil || a.Pace == nil || len(a.Pace.SpentCents) != 10 {
		t.Errorf("april = %+v, want both, the pace up to April 10", a)
	}
}

func TestCommitmentsNegativeLeftoverGivesANegativeDailyAllowance(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 1), http.StatusNoContent)
	seedRow(t, app, "ana@example.com", "2027-03-02", "expense", -5000)
	months, _ := readPace(t, app, ana, time.Date(2027, time.March, 31, 12, 0, 0, 0, time.UTC))
	if m := months[0]; m.LeftoverCents == nil || *m.LeftoverCents >= 0 || m.DailyAllowanceCents == nil || *m.DailyAllowanceCents != *m.LeftoverCents {
		t.Errorf("march = %+v, want a negative daily allowance as it is", m)
	}
}
