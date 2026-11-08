package finance_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// commitmentsRaw reads the commitments as generic JSON, to tell an absent key from null and zero.
func commitmentsRaw(t *testing.T, c *apitest.Client) (top map[string]any, months []map[string]any) {
	t.Helper()
	res := c.Get("/me/finance/commitments?from=2026-11")
	if res.Status != http.StatusOK {
		t.Fatalf("GET commitments = %d %s", res.Status, res.Raw)
	}
	var b struct{ Months []map[string]any }
	if err := json.Unmarshal(res.Raw, &top); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatal(err)
	}
	return top, b.Months
}

func putIncome(c *apitest.Client, v any) apitest.Response {
	return c.Put("/me/finance/income", map[string]any{"monthlyIncomeCents": v})
}

func TestCommitmentsWithoutIncomeHaveNoPercent(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	newBill(t, ana, "Rent", 150000, 5)
	top, months := commitmentsRaw(t, ana)
	if v, ok := top["monthlyIncomeCents"]; !ok || v != nil {
		t.Errorf("monthlyIncomeCents = %v (present %v), want null", v, ok)
	}
	for _, m := range months {
		if _, ok := m["percentOfIncome"]; ok {
			t.Errorf("month %v has percentOfIncome with no income", m["month"])
		}
		if m["committedCents"].(float64) != 150000 {
			t.Errorf("committedCents = %v, want 150000", m["committedCents"])
		}
	}
}

func TestCommitmentsPercentOfIncome(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name              string
		income, bill, pct int64
	}{
		{"thirty", 500000, 150000, 30},
		{"a third rounds down", 300000, 100000, 33},
		{"two thirds round up", 300000, 200000, 67},
		{"over a hundred", 120000, 150000, 125},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, ana := seedMonth(t)
			newBill(t, ana, "Rent", tc.bill, 5)
			apitest.ExpectStatus(t, putIncome(ana, tc.income), http.StatusNoContent)
			top, months := commitmentsRaw(t, ana)
			if top["monthlyIncomeCents"] != float64(tc.income) {
				t.Errorf("monthlyIncomeCents = %v, want %d", top["monthlyIncomeCents"], tc.income)
			}
			for _, m := range months {
				if m["percentOfIncome"] != float64(tc.pct) {
					t.Errorf("month %v percentOfIncome = %v, want %d", m["month"], m["percentOfIncome"], tc.pct)
				}
			}
		})
	}
}

func TestZeroCommittedIsZeroPercentNotAbsent(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 500000), http.StatusNoContent)
	_, months := commitmentsRaw(t, ana)
	if v, ok := months[0]["percentOfIncome"]; !ok || v != float64(0) {
		t.Errorf("percentOfIncome = %v (present %v), want 0", v, ok)
	}
}

func TestClearingIncomeRemovesThePercent(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	newBill(t, ana, "Rent", 150000, 5)
	apitest.ExpectStatus(t, putIncome(ana, 500000), http.StatusNoContent)
	apitest.ExpectStatus(t, putIncome(ana, nil), http.StatusNoContent)
	top, months := commitmentsRaw(t, ana)
	if top["monthlyIncomeCents"] != nil {
		t.Errorf("monthlyIncomeCents = %v, want null", top["monthlyIncomeCents"])
	}
	if _, ok := months[0]["percentOfIncome"]; ok {
		t.Error("percentOfIncome stays after clearing")
	}
	apitest.ExpectStatus(t, putIncome(ana, nil), http.StatusNoContent) // clearing twice is fine
}

func TestInvalidIncomeIs400(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 500000), http.StatusNoContent)
	for name, v := range map[string]any{
		"zero": 0, "negative": -5, "float": 1.5, "string": "100", "too big": int64(1_000_000_000_001),
	} {
		if res := putIncome(ana, v); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", name, res.Status)
		}
	}
	if top, _ := commitmentsRaw(t, ana); top["monthlyIncomeCents"] != float64(500000) {
		t.Errorf("a refused value changed the income to %v", top["monthlyIncomeCents"])
	}
	apitest.ExpectStatus(t, putIncome(ana, int64(1_000_000_000_000)), http.StatusNoContent) // the bound itself is allowed
}

func TestIncomeIsPerUser(t *testing.T) {
	t.Parallel()
	_, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	apitest.ExpectStatus(t, putIncome(users["ana@example.com"], 500000), http.StatusNoContent)
	if top, _ := commitmentsRaw(t, users["bob@example.com"]); top["monthlyIncomeCents"] != nil {
		t.Errorf("bob sees %v", top["monthlyIncomeCents"])
	}
}
