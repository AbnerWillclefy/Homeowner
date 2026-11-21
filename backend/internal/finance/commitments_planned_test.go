package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type plannedBody struct {
	Months []struct {
		Planned []struct {
			Category  string
			Cents     int64
			PaceCents int64
			Limited   bool
		}
		PlannedCents, OtherInstallmentsCents, TotalCents int64
		SpentOffCardCents, LeftoverCents                 *int64
		PacePlannedCents, PaceLeftoverCents              *int64
		Cards                                            []struct{ AmountCents int64 }
		OtherBills                                       []struct{ Cents int64 }
	}
}

func readPlanned(t *testing.T, c *apitest.Client) plannedBody {
	t.Helper()
	res := c.Get("/me/finance/commitments?from=2026-11")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var b plannedBody
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestCommitmentsPlanSpendingFromTheLimits(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t) // the fake clock is 2026-11-08
	apitest.ExpectStatus(t, ana.Put("/me/finance/income", map[string]int64{"monthlyIncomeCents": 5000000}), http.StatusNoContent)
	base := readPlanned(t, ana)
	// Without limits each category plans its median over Aug, Sep and Oct, less what November already counts.
	// Medians: housing 80000, household_bills 30500, health 8990, subscriptions 7780: 127270 in all.
	// November already holds housing 80000 and subscriptions 7780, which cover their medians, so it plans 30500 + 8990.
	if m := base.Months[0]; len(m.Planned) != 4 || m.PlannedCents != 39490 || m.SpentOffCardCents == nil || base.Months[1].SpentOffCardCents != nil || base.Months[1].PlannedCents != 127270 {
		t.Fatalf("without limits = %+v, want the 3-month median planned and already spent only on the current month", base.Months[:2])
	}

	insertTxn(t, app, "g1", "2026-11-03", -30000, "groceries")
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 100000}), http.StatusNoContent)
	got := readPlanned(t, ana)
	for i, want := range []int64{70000, 100000} {
		m := got.Months[i]
		var groceries int64 = -1
		for _, p := range m.Planned {
			if p.Category == "groceries" {
				groceries = p.Cents
			}
		}
		if groceries != want || m.PlannedCents != base.Months[i].PlannedCents+want {
			t.Errorf("month %d planned = %+v (%d), want groceries %d added to the baseline", i, m.Planned, m.PlannedCents, want)
		}
	}
	if m, b := got.Months[0], base.Months[0]; m.TotalCents != b.TotalCents+30000+70000 || *m.LeftoverCents != 5000000-m.TotalCents {
		t.Errorf("november total %d leftover %d, want the 30000 on the card and 70000 planned added to %d", m.TotalCents, *m.LeftoverCents, b.TotalCents)
	}
	if got.Months[1].SpentOffCardCents != nil {
		t.Errorf("december already spent = %d, want absent", *got.Months[1].SpentOffCardCents)
	}

	// 20000 spent off the card counts; the 50000 that paid a Bill does not.
	for _, r := range []struct {
		id    string
		cents int64
	}{{"off", -20000}, {"paid", -50000}} {
		if _, err := app.DB.Exec(context.Background(), `
			INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
				merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
			SELECT user_id, id, $1, '2026-11-02', $2, 'BRL', $1, $1, 'expense', 'auto', 'groceries', 'user', now(), now()
			FROM finance_sources WHERE kind = 'checking' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com') LIMIT 1`, r.id, r.cents); err != nil {
			t.Fatal(err)
		}
	}
	bill := newBill(t, ana, "Aluguel", 50000, 10)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, transaction_id, paid_at, expected_cents)
		SELECT $1::uuid, user_id, '2026-11-01', 'bank', id, now(), 50000 FROM finance_transactions WHERE provider_id = 'paid'`, bill); err != nil {
		t.Fatal(err)
	}
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 200000}), http.StatusNoContent)
	got = readPlanned(t, ana)
	m := got.Months[0]
	if m.SpentOffCardCents == nil || *m.SpentOffCardCents != *base.Months[0].SpentOffCardCents+20000 {
		t.Errorf("already spent = %v, want the baseline plus 20000", m.SpentOffCardCents)
	}
	if want := base.Months[0].PlannedCents + 100000; m.PlannedCents != want { // 200000 less 30000 on the card and 70000 off it, the Bill's included
		t.Errorf("planned = %d, want %d", m.PlannedCents, want)
	}
	// Undoing the payment frees the Expense: it counts as spent off the card again.
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_bill_payments SET undone_at = now() WHERE bill_id = $1::uuid`, bill); err != nil {
		t.Fatal(err)
	}
	if u := readPlanned(t, ana).Months[0]; u.SpentOffCardCents == nil || *u.SpentOffCardCents != *m.SpentOffCardCents+50000 {
		t.Errorf("after undo already spent = %v, want %d", u.SpentOffCardCents, *m.SpentOffCardCents+50000)
	}
	sum := m.PlannedCents + *m.SpentOffCardCents + m.OtherInstallmentsCents
	for _, c := range m.Cards {
		sum += c.AmountCents
	}
	for _, b := range m.OtherBills {
		sum += b.Cents
	}
	if m.TotalCents != sum || *m.LeftoverCents != 5000000-sum {
		t.Errorf("total %d leftover %d, want %d and %d", m.TotalCents, *m.LeftoverCents, sum, 5000000-sum)
	}
}

// A one-off month does not move the Usual spending (the median), and a limit
// moves only the plan by limit: the Leftover at current pace ignores it.
func TestCommitmentsPlanByPlanAndAtPace(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t) // the fake clock is 2026-11-08
	apitest.ExpectStatus(t, ana.Put("/me/finance/income", map[string]int64{"monthlyIncomeCents": 5000000}), http.StatusNoContent)
	for i, m := range []string{"2026-08-10", "2026-09-10", "2026-10-10"} {
		insertTxn(t, app, "g"+m, m, -150000, "groceries")
		insertTxn(t, app, "e"+m, m, -[]int64{20000, 20000, 300000}[i], "eating_out") // October is the one-off
	}
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 100000}), http.StatusNoContent)
	line := func(b plannedBody, month int, category string) (c, pace int64, limited bool) {
		for _, p := range b.Months[month].Planned {
			if p.Category == category {
				return p.Cents, p.PaceCents, p.Limited
			}
		}
		t.Fatalf("month %d has no %s line: %+v", month, category, b.Months[month].Planned)
		return
	}

	dec := readPlanned(t, ana)
	if c, pace, limited := line(dec, 1, "eating_out"); c != 20000 || pace != 20000 || limited { // the mean would be 113333
		t.Errorf("eating_out = %d, %d, limited %v, want the median 20000 for both", c, pace, limited)
	}
	if c, pace, limited := line(dec, 1, "groceries"); c != 100000 || pace != 150000 || !limited {
		t.Errorf("groceries = %d, %d, limited %v, want the limit 100000 and the median 150000", c, pace, limited)
	}
	d := dec.Months[1]
	if d.LeftoverCents == nil || d.PaceLeftoverCents == nil || d.PacePlannedCents == nil || *d.PaceLeftoverCents != *d.LeftoverCents-50000 {
		t.Errorf("december leftovers = %v, %v, want the pace one 50000 lower", d.LeftoverCents, d.PaceLeftoverCents)
	}

	// Both plans subtract what November already holds, and neither goes below 0.
	insertTxn(t, app, "g-nov", "2026-11-03", -120000, "groceries")
	if c, pace, _ := line(readPlanned(t, ana), 0, "groceries"); c != 0 || pace != 30000 {
		t.Errorf("november groceries = %d, %d, want 0 and 30000", c, pace)
	}

	// Without a Monthly income both pace fields are absent, not null.
	apitest.ExpectStatus(t, ana.Put("/me/finance/income", map[string]*int64{"monthlyIncomeCents": nil}), http.StatusNoContent)
	res := ana.Get("/me/finance/commitments?from=2026-11")
	var raw struct{ Months []map[string]any }
	if err := json.Unmarshal(res.Raw, &raw); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"pacePlannedCents", "paceLeftoverCents"} {
		if v, has := raw.Months[0][key]; has {
			t.Errorf("%s = %v with no income, want it absent", key, v)
		}
	}
}
