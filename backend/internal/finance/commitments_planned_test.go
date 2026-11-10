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
			Category string
			Cents    int64
		}
		PlannedCents, OtherInstallmentsCents, TotalCents int64
		SpentOffCardCents, LeftoverCents                 *int64
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
	if m := base.Months[0]; len(m.Planned) != 0 || m.PlannedCents != 0 || m.SpentOffCardCents == nil || base.Months[1].SpentOffCardCents != nil {
		t.Fatalf("without limits = %+v, want nothing planned and already spent only on the current month", base.Months[:2])
	}

	insertTxn(t, app, "g1", "2026-11-03", -30000, "groceries")
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 100000}), http.StatusNoContent)
	got := readPlanned(t, ana)
	for i, want := range []int64{70000, 100000} {
		m := got.Months[i]
		if len(m.Planned) != 1 || m.Planned[0].Category != "groceries" || m.Planned[0].Cents != want || m.PlannedCents != want {
			t.Errorf("month %d planned = %+v (%d), want groceries %d", i, m.Planned, m.PlannedCents, want)
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
	if m.PlannedCents != 100000 { // 200000 less 30000 on the card and 70000 off it, the Bill's included
		t.Errorf("planned = %d, want 100000", m.PlannedCents)
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
