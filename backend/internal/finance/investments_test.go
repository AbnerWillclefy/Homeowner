package finance_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func investmentBody(name string, cents int64, serves string) map[string]any {
	return map[string]any{"name": name, "valueCents": cents, "serves": serves}
}

func newInvestment(t *testing.T, c *apitest.Client, name string, cents int64, serves string) string {
	t.Helper()
	res := c.Post("/me/finance/investments", investmentBody(name, cents, serves))
	apitest.ExpectStatus(t, res, http.StatusCreated)
	return res.Body["id"].(string)
}

// savedInvestments reads the Investments through GET /me/finance/savings.
func savedInvestments(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	res := c.Get("/me/finance/savings")
	apitest.ExpectStatus(t, res, http.StatusOK)
	list, _ := res.Body["investments"].([]any)
	out := []map[string]any{}
	for _, v := range list {
		out = append(out, v.(map[string]any))
	}
	return out
}

func TestInvestmentCreateReadUpdateDelete(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	got := savedInvestments(t, ana)
	if len(got) != 1 || got[0]["id"] != id || got[0]["name"] != "CDB" || got[0]["valueCents"] != float64(100000) || got[0]["serves"] != "reserve" {
		t.Fatalf("savings = %v", got)
	}
	for _, body := range []map[string]any{
		investmentBody("Tesouro", 100000, "reserve"),
		investmentBody("Tesouro", 250000, "reserve"),
		investmentBody("Tesouro", 250000, "goals"),
		investmentBody("Tesouro", 0, "goals"), // emptied but kept
	} {
		res := ana.Put("/me/finance/investments/"+id, body)
		apitest.ExpectStatus(t, res, http.StatusOK)
		if res.Body["id"] != id || res.Body["name"] != body["name"] || res.Body["valueCents"] != float64(body["valueCents"].(int64)) || res.Body["serves"] != body["serves"] {
			t.Errorf("put answer = %s", res.Raw)
		}
		got := savedInvestments(t, ana)
		if len(got) != 1 || got[0]["name"] != body["name"] || got[0]["valueCents"] != float64(body["valueCents"].(int64)) || got[0]["serves"] != body["serves"] {
			t.Errorf("savings after put = %v", got)
		}
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/investments/"+id), http.StatusNoContent)
	if got := savedInvestments(t, ana); len(got) != 0 {
		t.Errorf("savings after delete = %v", got)
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/investments/"+id), http.StatusNotFound)
}

func TestInvestmentsAreOrderedByNameAndMayShareOne(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	newInvestment(t, ana, "b", 1, "goals")
	newInvestment(t, ana, "a", 2, "goals")
	newInvestment(t, ana, "a", 3, "reserve")
	got := savedInvestments(t, ana)
	if len(got) != 3 || got[0]["name"] != "a" || got[1]["name"] != "a" || got[2]["name"] != "b" {
		t.Fatalf("savings = %v", got)
	}
	if got[0]["id"].(string) >= got[1]["id"].(string) {
		t.Errorf("same names must be ordered by id: %v", got)
	}
}

func TestAnotherUsersInvestmentIsNotFoundAndUnchanged(t *testing.T) {
	t.Parallel()
	app, ana, bia := twoUsers(t)
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	apitest.ExpectStatus(t, bia.Put("/me/finance/investments/"+id, investmentBody("x", 1, "goals")), http.StatusNotFound)
	apitest.ExpectStatus(t, bia.Delete("/me/finance/investments/"+id), http.StatusNotFound)
	if got := savedInvestments(t, bia); len(got) != 0 {
		t.Errorf("other User sees %v", got)
	}
	var name, serves string
	var cents int64
	if err := app.DB.QueryRow(context.Background(), `SELECT name, value_cents, serves FROM finance_investments WHERE id = $1`, id).Scan(&name, &cents, &serves); err != nil {
		t.Fatal(err)
	}
	if name != "CDB" || cents != 100000 || serves != "reserve" {
		t.Errorf("row changed: %s %d %s", name, cents, serves)
	}
}

func TestUnknownAndMalformedInvestmentIdsAreNotFound(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	for _, id := range []string{"00000000-0000-4000-8000-000000000000", "nope", "123"} {
		apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("x", 1, "goals")), http.StatusNotFound)
		apitest.ExpectStatus(t, ana.Delete("/me/finance/investments/"+id), http.StatusNotFound)
	}
}

func TestInvestmentValidationNamesTheFields(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	id := newInvestment(t, ana, "CDB", 5, "goals")
	for name, c := range map[string]struct {
		body   map[string]any
		fields map[string]string
	}{
		"all missing":   {map[string]any{}, map[string]string{"name": "required", "serves": "invalid"}},
		"blank name":    {investmentBody("  ", 1, "goals"), map[string]string{"name": "required"}},
		"long name":     {investmentBody(strings.Repeat("a", 61), 1, "goals"), map[string]string{"name": "too_long"}},
		"control char":  {investmentBody("a\u0000b", 1, "goals"), map[string]string{"name": "invalid"}},
		"negative":      {investmentBody("a", -1, "goals"), map[string]string{"valueCents": "invalid"}},
		"too large":     {investmentBody("a", 1_000_000_000_001, "goals"), map[string]string{"valueCents": "invalid"}},
		"unknown serve": {investmentBody("a", 1, "fun"), map[string]string{"serves": "invalid"}},
		"empty serve":   {investmentBody("a", 1, ""), map[string]string{"serves": "invalid"}},
	} {
		for _, res := range []apitest.Response{ana.Post("/me/finance/investments", c.body), ana.Put("/me/finance/investments/"+id, c.body)} {
			if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid investment" {
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
	}
	for _, raw := range []string{
		`{"name":"a","valueCents":1.5,"serves":"goals"}`,
		`{"name":"a","valueCents":"9","serves":"goals"}`,
		`{"name":"a","valueCents":1,"serves":"goals","x":1}`,
	} {
		if res := ana.SendRaw(http.MethodPost, "/me/finance/investments", []byte(raw)); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", raw, res.Status)
		}
	}
	if got := savedInvestments(t, ana); len(got) != 1 || got[0]["valueCents"] != float64(5) {
		t.Errorf("a refused request changed the data: %v", got)
	}
}
