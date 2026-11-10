package finance_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func putReserve(c *apitest.Client, v any) apitest.Response {
	return c.Put("/me/finance/reserve", map[string]any{"targetCents": v})
}

func putContribution(c *apitest.Client, base, share any) apitest.Response {
	return c.Put("/me/finance/contribution", map[string]any{"baseCents": base, "reserveSharePercent": share})
}

// wantSavings checks the three settings and that both lists are empty arrays.
func wantSavings(t *testing.T, c *apitest.Client, reserve, base, share any) {
	t.Helper()
	res := c.Get("/me/finance/savings")
	apitest.ExpectStatus(t, res, http.StatusOK)
	for k, want := range map[string]any{"reserveTargetCents": reserve, "contributionBaseCents": base, "reserveSharePercent": share} {
		if v, ok := res.Body[k]; !ok || v != want {
			t.Errorf("%s = %v (present %v), want %v", k, v, ok, want)
		}
	}
	for _, k := range []string{"investments", "goals"} {
		if l, ok := res.Body[k].([]any); !ok || len(l) != 0 {
			t.Errorf("%s = %v, want an empty list", k, res.Body[k])
		}
	}
}

func TestSavingsWithNothingSet(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	wantSavings(t, ana, nil, nil, nil)
}

func TestSavingsAfterEachPutAndClear(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putReserve(ana, 600000), http.StatusNoContent)
	wantSavings(t, ana, float64(600000), nil, nil)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 40), http.StatusNoContent)
	wantSavings(t, ana, float64(600000), float64(100000), float64(40))
	apitest.ExpectStatus(t, putReserve(ana, nil), http.StatusNoContent)
	wantSavings(t, ana, nil, float64(100000), float64(40))
	apitest.ExpectStatus(t, putContribution(ana, nil, nil), http.StatusNoContent)
	wantSavings(t, ana, nil, nil, nil)
}

func TestShareBoundsAreValid(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 0), http.StatusNoContent)
	wantSavings(t, ana, nil, float64(100000), float64(0))
	apitest.ExpectStatus(t, putContribution(ana, 100000, 100), http.StatusNoContent)
	wantSavings(t, ana, nil, float64(100000), float64(100))
	apitest.ExpectStatus(t, putReserve(ana, int64(1_000_000_000_000)), http.StatusNoContent)
}

func TestInvalidReserveIs400(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putReserve(ana, 500000), http.StatusNoContent)
	for name, v := range map[string]any{
		"zero": 0, "negative": -5, "float": 1.5, "string": "100", "too big": int64(1_000_000_000_001),
	} {
		if res := putReserve(ana, v); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", name, res.Status)
		}
	}
	if res := ana.Put("/me/finance/reserve", map[string]any{"targetCents": 1, "extra": 1}); res.Status != http.StatusBadRequest {
		t.Errorf("extra key = %d, want 400", res.Status)
	}
	wantSavings(t, ana, float64(500000), nil, nil)
}

func TestInvalidContributionIs400(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 40), http.StatusNoContent)
	for _, tc := range []struct {
		name        string
		base, share any
	}{
		{"zero base", 0, 40}, {"negative base", -5, 40}, {"float base", 1.5, 40}, {"string base", "100", 40},
		{"too big base", int64(1_000_000_000_001), 40},
		{"share over 100", 100000, 101}, {"negative share", 100000, -1}, {"float share", 100000, 40.5}, {"string share", 100000, "40"},
		{"base without share", 100000, nil}, {"share without base", nil, 40},
	} {
		if res := putContribution(ana, tc.base, tc.share); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", tc.name, res.Status)
		}
	}
	if res := ana.Put("/me/finance/contribution", map[string]any{"baseCents": 1}); res.Status != http.StatusBadRequest {
		t.Errorf("missing share key = %d, want 400", res.Status)
	}
	wantSavings(t, ana, nil, float64(100000), float64(40))
}

func TestSavingsSettingsKeepTheIncomeAndTheReverse(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putIncome(ana, 500000), http.StatusNoContent)
	apitest.ExpectStatus(t, putReserve(ana, 600000), http.StatusNoContent)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 40), http.StatusNoContent)
	if top, _ := commitmentsRaw(t, ana); top["monthlyIncomeCents"] != float64(500000) {
		t.Errorf("income = %v after the savings settings, want 500000", top["monthlyIncomeCents"])
	}
	apitest.ExpectStatus(t, putIncome(ana, 700000), http.StatusNoContent)
	wantSavings(t, ana, float64(600000), float64(100000), float64(40))
}
