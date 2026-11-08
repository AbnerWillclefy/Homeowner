package finance_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func putLimit(c *apitest.Client, category string, body any) apitest.Response {
	return c.Put("/me/finance/budgets/"+category, body)
}

// limitsOf reads "limits" off the month read as generic JSON, to tell {} from null.
func limitsOf(t *testing.T, c *apitest.Client, month string) map[string]any {
	t.Helper()
	res := c.Get("/me/finance/transactions?month=" + month)
	if res.Status != http.StatusOK {
		t.Fatalf("GET month = %d %s", res.Status, res.Raw)
	}
	l, ok := res.Body["limits"].(map[string]any)
	if !ok {
		t.Fatalf("limits = %v, want an object: %s", res.Body["limits"], res.Raw)
	}
	return l
}

func TestLimitsSetChangeRemoveShowOnEveryMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	if l := limitsOf(t, ana, "2026-11"); len(l) != 0 {
		t.Fatalf("limits = %v, want none", l)
	}
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]any{"limitCents": 50000}), http.StatusNoContent)
	apitest.ExpectStatus(t, putLimit(ana, "eating_out", map[string]any{"limitCents": 1}), http.StatusNoContent)
	for _, m := range []string{"2026-11", "2025-03"} {
		if l := limitsOf(t, ana, m); len(l) != 2 || l["groceries"] != float64(50000) || l["eating_out"] != float64(1) {
			t.Errorf("%s limits = %v", m, l)
		}
	}
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]any{"limitCents": 70000}), http.StatusNoContent)
	apitest.ExpectStatus(t, putLimit(ana, "eating_out", map[string]any{"limitCents": nil}), http.StatusNoContent)
	apitest.ExpectStatus(t, putLimit(ana, "transport", map[string]any{"limitCents": nil}), http.StatusNoContent)
	for _, m := range []string{"2026-11", "2025-03"} {
		if l := limitsOf(t, ana, m); len(l) != 1 || l["groceries"] != float64(70000) {
			t.Errorf("%s limits = %v", m, l)
		}
	}
}

func TestLimitsRejectBadInput(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	for name, c := range map[string]struct {
		category string
		body     any
		want     string
	}{
		"zero":     {"groceries", map[string]any{"limitCents": 0}, "invalid limit"},
		"negative": {"groceries", map[string]any{"limitCents": -1}, "invalid limit"},
		"too big":  {"groceries", map[string]any{"limitCents": int64(1_000_000_000_001)}, "invalid limit"},
		"float":    {"groceries", map[string]any{"limitCents": 1.5}, ""},
		"missing":  {"groceries", map[string]any{}, ""},
		"unknown":  {"pizza", map[string]any{"limitCents": 100}, "invalid category"},
	} {
		res := putLimit(ana, c.category, c.body)
		if res.Status != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400: %s", name, res.Status, res.Raw)
		} else if c.want != "" && res.Body["error"] != c.want {
			t.Errorf("%s: error = %v, want %q", name, res.Body["error"], c.want)
		}
	}
	if l := limitsOf(t, ana, "2026-11"); len(l) != 0 {
		t.Errorf("limits = %v after rejected requests", l)
	}
}

func TestLimitsAreOwnedByTheUser(t *testing.T) {
	t.Parallel()
	_, ana, bia := twoUsers(t)
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]any{"limitCents": 500}), http.StatusNoContent)
	if l := limitsOf(t, bia, "2026-11"); len(l) != 0 {
		t.Errorf("bia sees %v", l)
	}
	apitest.ExpectStatus(t, putLimit(bia, "groceries", map[string]any{"limitCents": nil}), http.StatusNoContent)
	if l := limitsOf(t, ana, "2026-11"); l["groceries"] != float64(500) {
		t.Errorf("ana's limit changed: %v", l)
	}
}

func TestLimitsNeedTheFinanceAllowlist(t *testing.T) {
	t.Parallel()
	app, _, _ := twoUsers(t)
	if res := putLimit(app.SignInAs("bob@example.com"), "groceries", map[string]any{"limitCents": 5}); res.Status != http.StatusForbidden {
		t.Errorf("PUT = %d, want 403", res.Status)
	}
}
