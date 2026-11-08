package finance_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type billBody struct {
	ID, Name, DueDate string
	ExpectedCents     int64
	DueDay            int
	Paid              bool
	PaidBy            *string
}

func twoUsers(t *testing.T) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bia@example.com"))
	return app, app.SignInAs("ana@example.com"), app.SignInAs("bia@example.com")
}

func newBill(t *testing.T, c *apitest.Client, name string, cents int64, day int) string {
	t.Helper()
	res := c.Post("/me/finance/bills", map[string]any{"name": name, "expectedCents": cents, "dueDay": day})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	return res.Body["id"].(string)
}

func listBills(t *testing.T, c *apitest.Client, month string) []billBody {
	t.Helper()
	res := c.Get("/me/finance/bills?month=" + month)
	apitest.ExpectStatus(t, res, http.StatusOK)
	var out []billBody
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestABillIsCreatedUpdatedListedAndDeleted(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)

	res := ana.Post("/me/finance/bills", map[string]any{"name": "  Rent ", "expectedCents": 150000, "dueDay": 5})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	id := res.Body["id"].(string)
	if res.Body["name"] != "Rent" || res.Body["expectedCents"] != float64(150000) || res.Body["dueDay"] != float64(5) {
		t.Errorf("created = %s", res.Raw)
	}

	up := ana.Put("/me/finance/bills/"+id, map[string]any{"name": "Rent flat", "expectedCents": 160000, "dueDay": 10})
	apitest.ExpectStatus(t, up, http.StatusOK)
	if up.Body["name"] != "Rent flat" || up.Body["expectedCents"] != float64(160000) || up.Body["dueDay"] != float64(10) {
		t.Errorf("updated = %s", up.Raw)
	}

	got := listBills(t, ana, "2026-11")
	if len(got) != 1 || got[0].ID != id || got[0].DueDate != "2026-11-10" || got[0].Paid || got[0].PaidBy != nil {
		t.Errorf("list = %+v", got)
	}

	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+id), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11"); len(got) != 0 {
		t.Errorf("list after delete = %+v", got)
	}
	if res := ana.Get("/me/finance/bills?month=2026-11"); string(res.Raw) == "null" {
		t.Error("an empty list must be [], not null")
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+id), http.StatusNotFound)
}

func TestBillValidationReportsEveryFieldWithAStableCode(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	for name, c := range map[string]struct {
		body   map[string]any
		fields map[string]string
	}{
		"all missing":     {map[string]any{}, map[string]string{"name": "required", "expectedCents": "invalid", "dueDay": "invalid"}},
		"blank name":      {map[string]any{"name": "   ", "expectedCents": 1, "dueDay": 1}, map[string]string{"name": "required"}},
		"long name":       {map[string]any{"name": strings.Repeat("a", 61), "expectedCents": 1, "dueDay": 1}, map[string]string{"name": "too_long"}},
		"control char":    {map[string]any{"name": "a\u0000b", "expectedCents": 1, "dueDay": 1}, map[string]string{"name": "invalid"}},
		"zero amount":     {map[string]any{"name": "a", "expectedCents": 0, "dueDay": 1}, map[string]string{"expectedCents": "invalid"}},
		"negative amount": {map[string]any{"name": "a", "expectedCents": -5, "dueDay": 1}, map[string]string{"expectedCents": "invalid"}},
		"huge amount":     {map[string]any{"name": "a", "expectedCents": int64(1_000_000_000_001), "dueDay": 1}, map[string]string{"expectedCents": "invalid"}},
		"day 0":           {map[string]any{"name": "a", "expectedCents": 1, "dueDay": 0}, map[string]string{"dueDay": "invalid"}},
		"day 32":          {map[string]any{"name": "a", "expectedCents": 1, "dueDay": 32}, map[string]string{"dueDay": "invalid"}},
	} {
		res := ana.Post("/me/finance/bills", c.body)
		if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid bill" {
			t.Errorf("%s: %d %s", name, res.Status, res.Raw)
			continue
		}
		fields, _ := res.Body["fields"].(map[string]any)
		if len(fields) != len(c.fields) {
			t.Errorf("%s: fields = %v, want %v", name, fields, c.fields)
		}
		for f, code := range c.fields {
			if fields[f] != code {
				t.Errorf("%s: fields[%s] = %v, want %s", name, f, fields[f], code)
			}
		}
	}
	// A float or a string amount fails the decode.
	for _, raw := range []string{`{"name":"a","expectedCents":1.5,"dueDay":1}`, `{"name":"a","expectedCents":"9","dueDay":1}`, `{"name":"a","expectedCents":1,"dueDay":1,"x":1}`} {
		if res := ana.SendRaw(http.MethodPost, "/me/finance/bills", []byte(raw)); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", raw, res.Status)
		}
	}
	if got := listBills(t, ana, "2026-11"); len(got) != 0 {
		t.Errorf("a refused bill was stored: %+v", got)
	}
	id := newBill(t, ana, "Water", 100, 1)
	if res := ana.Put("/me/finance/bills/"+id, map[string]any{"name": "", "expectedCents": 1, "dueDay": 1}); res.Status != http.StatusBadRequest {
		t.Errorf("PUT with a blank name = %d, want 400", res.Status)
	}
}

func TestADueDayOf31FallsOnTheLastDayOfAShortMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	newBill(t, ana, "Card", 5000, 31)
	for month, want := range map[string]string{"2026-02": "2026-02-28", "2028-02": "2028-02-29", "2026-04": "2026-04-30", "2026-01": "2026-01-31"} {
		if got := listBills(t, ana, month); len(got) != 1 || got[0].DueDate != want {
			t.Errorf("%s: %+v, want due %s", month, got, want)
		}
	}
}

func TestListNeedsAValidMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	for _, q := range []string{"", "?month=", "?month=2026-13", "?month=1999-12", "?month=abc"} {
		if res := ana.Get("/me/finance/bills" + q); res.Status != http.StatusBadRequest {
			t.Errorf("GET bills%s = %d, want 400", q, res.Status)
		}
	}
}

func TestPayingByHandThenUndoing(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	id := newBill(t, ana, "Rent", 150000, 5)
	pay := "/me/finance/bills/" + id + "/payments/2026-11"

	apitest.ExpectStatus(t, ana.Put(pay, nil), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put(pay, nil), http.StatusNoContent) // idempotent
	got := listBills(t, ana, "2026-11")
	if len(got) != 1 || !got[0].Paid || got[0].PaidBy == nil || *got[0].PaidBy != "hand" {
		t.Errorf("November = %+v, want paid by hand", got)
	}
	if got := listBills(t, ana, "2026-12"); got[0].Paid {
		t.Errorf("December = %+v, want unpaid", got)
	}

	apitest.ExpectStatus(t, ana.Delete(pay), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Delete(pay), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11"); got[0].Paid || got[0].PaidBy != nil {
		t.Errorf("after undo = %+v, want unpaid", got)
	}
	for _, bad := range []string{"2026-13", "1999-01", "x", "2026-1"} {
		if res := ana.Put("/me/finance/bills/"+id+"/payments/"+bad, nil); res.Status != http.StatusBadRequest {
			t.Errorf("PUT payment %s = %d, want 400", bad, res.Status)
		}
	}
}

func TestAPaymentFromTheBankIsKeptWhenMarkedByHand(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	id := newBill(t, ana, "Rent", 150000, 5)
	if _, err := app.DB.Exec(t.Context(), `INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, paid_at)
		SELECT id, user_id, '2026-11-01', 'bank', now() FROM finance_bills WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	if got := listBills(t, ana, "2026-11"); got[0].PaidBy == nil || *got[0].PaidBy != "bank" {
		t.Errorf("paidBy = %+v, want bank", got[0].PaidBy)
	}
}

func TestBillsOfAnotherUserAnswer404OnEveryRoute(t *testing.T) {
	t.Parallel()
	_, ana, bia := twoUsers(t)
	id := newBill(t, ana, "Rent", 150000, 5)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	valid := map[string]any{"name": "Mine", "expectedCents": 1, "dueDay": 1}

	for name, res := range map[string]apitest.Response{
		"update":      bia.Put("/me/finance/bills/"+id, valid),
		"delete":      bia.Delete("/me/finance/bills/" + id),
		"pay":         bia.Put("/me/finance/bills/"+id+"/payments/2026-12", nil),
		"unpay":       bia.Delete("/me/finance/bills/" + id + "/payments/2026-11"),
		"bad id":      bia.Delete("/me/finance/bills/not-a-uuid"),
		"bad id pay":  bia.Put("/me/finance/bills/not-a-uuid/payments/2026-11", nil),
		"bad id edit": bia.Put("/me/finance/bills/not-a-uuid", valid),
	} {
		if res.Status != http.StatusNotFound {
			t.Errorf("%s = %d %s, want 404", name, res.Status, res.Raw)
		}
	}
	if got := listBills(t, bia, "2026-11"); len(got) != 0 {
		t.Errorf("bia sees %+v", got)
	}
	got := listBills(t, ana, "2026-11")
	if len(got) != 1 || got[0].Name != "Rent" || !got[0].Paid {
		t.Errorf("ana's bill changed: %+v", got)
	}
}

func TestBillsNeedTheFinanceAllowlist(t *testing.T) {
	t.Parallel()
	app, _, _ := twoUsers(t)
	if res := app.SignInAs("bob@example.com").Get("/me/finance/bills?month=2026-11"); res.Status != http.StatusForbidden {
		t.Errorf("GET = %d, want 403", res.Status)
	}
}
