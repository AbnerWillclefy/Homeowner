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
		Bills []any
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
