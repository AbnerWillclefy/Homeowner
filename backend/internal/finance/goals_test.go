package finance_test

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func newGoal(t *testing.T, c *apitest.Client, name string) string {
	t.Helper()
	res := c.Post("/me/finance/goals", map[string]any{"name": name, "targetCents": 100000, "targetMonth": nil})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	return res.Body["id"].(string)
}

// goalNames reads the Goals' names in the order GET /me/finance/savings lists them.
func goalNames(t *testing.T, c *apitest.Client) []string {
	t.Helper()
	res := c.Get("/me/finance/savings")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var out struct{ Goals []struct{ Name string } }
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	names := []string{}
	for _, g := range out.Goals {
		names = append(names, g.Name)
	}
	return names
}

func wantGoals(t *testing.T, c *apitest.Client, want ...string) {
	t.Helper()
	if got := goalNames(t, c); !slices.Equal(got, want) {
		t.Errorf("goals = %v, want %v", got, want)
	}
}

func putOrder(c *apitest.Client, ids ...string) apitest.Response {
	return c.Put("/me/finance/goals/order", map[string]any{"ids": append([]string{}, ids...)})
}

func TestGoalsAreCreatedOrderedReorderedAndDeleted(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	a, b, c := newGoal(t, ana, "A"), newGoal(t, ana, "B"), newGoal(t, ana, "C")
	wantGoals(t, ana, "A", "B", "C")

	apitest.ExpectStatus(t, putOrder(ana, c, a, b), http.StatusNoContent)
	wantGoals(t, ana, "C", "A", "B")

	apitest.ExpectStatus(t, ana.Delete("/me/finance/goals/"+a), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/goals/"+a), http.StatusNotFound)
	newGoal(t, ana, "D")
	wantGoals(t, ana, "C", "B", "D")
}

func TestAGoalKeepsItsFieldsAndCanBeChanged(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	res := ana.Post("/me/finance/goals", map[string]any{"name": " Trip ", "targetCents": 500000, "targetMonth": "2027-07"})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	id := res.Body["id"].(string)
	if res.Body["name"] != "Trip" || res.Body["targetCents"] != float64(500000) || res.Body["targetMonth"] != "2027-07" {
		t.Errorf("created = %s", res.Raw)
	}
	// A month in the past is accepted.
	up := ana.Put("/me/finance/goals/"+id, map[string]any{"name": "Car", "targetCents": 900000, "targetMonth": "2020-01"})
	apitest.ExpectStatus(t, up, http.StatusOK)
	if up.Body["name"] != "Car" || up.Body["targetCents"] != float64(900000) || up.Body["targetMonth"] != "2020-01" {
		t.Errorf("updated = %s", up.Raw)
	}
	list := ana.Get("/me/finance/savings").Body["goals"].([]any)[0].(map[string]any)
	if list["id"] != id || list["name"] != "Car" || list["targetCents"] != float64(900000) || list["targetMonth"] != "2020-01" {
		t.Errorf("listed = %v", list)
	}
	if _, ok := list["position"]; ok {
		t.Error("position must not be sent")
	}
	up = ana.Put("/me/finance/goals/"+id, map[string]any{"name": "Car", "targetCents": 900000, "targetMonth": nil})
	apitest.ExpectStatus(t, up, http.StatusOK)
	if up.Body["targetMonth"] != nil {
		t.Errorf("targetMonth = %v, want null", up.Body["targetMonth"])
	}
}

func TestReorderRefusesAnyListThatIsNotTheUsersGoals(t *testing.T) {
	t.Parallel()
	_, ana, bia := twoUsers(t)
	a, b := newGoal(t, ana, "A"), newGoal(t, ana, "B")
	other := newGoal(t, bia, "Other")
	for name, ids := range map[string][]string{
		"missing":      {b},
		"repeated":     {a, a},
		"repeat, full": {a, b, a},
		"other user's": {a, other},
		"unknown":      {a, "00000000-0000-0000-0000-000000000000"},
		"malformed":    {a, "nope"},
		"empty":        {},
	} {
		if res := putOrder(ana, ids...); res.Status != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 400", name, res.Status, res.Raw)
		}
		wantGoals(t, ana, "A", "B")
	}
	// Extra key and wrong type are refused too.
	for _, raw := range []string{`{"ids":["x"],"y":1}`, `{"ids":"x"}`, `{}`} {
		if res := ana.SendRaw(http.MethodPut, "/me/finance/goals/order", []byte(raw)); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d, want 400", raw, res.Status)
		}
	}
	wantGoals(t, ana, "A", "B")
}

func TestReorderWithNoGoalsIs204(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	apitest.ExpectStatus(t, putOrder(ana), http.StatusNoContent)
}

func TestReorderIsNotReadAsAGoalId(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	id := newGoal(t, ana, "A")
	// A literal "order" route answers 204; as {id} it would answer 404.
	apitest.ExpectStatus(t, putOrder(ana, id), http.StatusNoContent)
}

func TestAnotherUsersGoalIsNotFound(t *testing.T) {
	t.Parallel()
	_, ana, bia := twoUsers(t)
	id := newGoal(t, ana, "A")
	body := map[string]any{"name": "X", "targetCents": 1, "targetMonth": nil}
	apitest.ExpectStatus(t, bia.Put("/me/finance/goals/"+id, body), http.StatusNotFound)
	apitest.ExpectStatus(t, bia.Delete("/me/finance/goals/"+id), http.StatusNotFound)
	apitest.ExpectStatus(t, putOrder(bia, id), http.StatusBadRequest)
	for _, bad := range []string{"00000000-0000-0000-0000-000000000000", "nope"} {
		apitest.ExpectStatus(t, ana.Put("/me/finance/goals/"+bad, body), http.StatusNotFound)
		apitest.ExpectStatus(t, ana.Delete("/me/finance/goals/"+bad), http.StatusNotFound)
	}
	wantGoals(t, ana, "A")
	wantGoals(t, bia)
}

func TestGoalValidationNamesTheFields(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	ok := func(k string, v any) map[string]any {
		b := map[string]any{"name": "a", "targetCents": 1, "targetMonth": nil}
		b[k] = v
		return b
	}
	for name, c := range map[string]struct {
		raw    string
		fields map[string]string
	}{
		"all missing":     {`{}`, map[string]string{"name": "required", "targetCents": "invalid"}},
		"blank name":      {`{"name":"  ","targetCents":1}`, map[string]string{"name": "required"}},
		"long name":       {`{"name":"` + strings.Repeat("a", 61) + `","targetCents":1}`, map[string]string{"name": "too_long"}},
		"control char":    {`{"name":"a\u0000b","targetCents":1}`, map[string]string{"name": "invalid"}},
		"zero":            {`{"name":"a","targetCents":0}`, map[string]string{"targetCents": "invalid"}},
		"negative":        {`{"name":"a","targetCents":-5}`, map[string]string{"targetCents": "invalid"}},
		"huge":            {`{"name":"a","targetCents":1000000000001}`, map[string]string{"targetCents": "invalid"}},
		"fractional":      {`{"name":"a","targetCents":1.5}`, map[string]string{"targetCents": "invalid"}},
		"exponent":        {`{"name":"a","targetCents":1e3}`, map[string]string{"targetCents": "invalid"}},
		"string":          {`{"name":"a","targetCents":"9"}`, map[string]string{"targetCents": "invalid"}},
		"null target":     {`{"name":"a","targetCents":null}`, map[string]string{"targetCents": "invalid"}},
		"month 13":        {`{"name":"a","targetCents":1,"targetMonth":"2027-13"}`, map[string]string{"targetMonth": "invalid"}},
		"month no pad":    {`{"name":"a","targetCents":1,"targetMonth":"2027-1"}`, map[string]string{"targetMonth": "invalid"}},
		"month full date": {`{"name":"a","targetCents":1,"targetMonth":"2027-01-15"}`, map[string]string{"targetMonth": "invalid"}},
		"month empty":     {`{"name":"a","targetCents":1,"targetMonth":""}`, map[string]string{"targetMonth": "invalid"}},
		"month year low":  {`{"name":"a","targetCents":1,"targetMonth":"1999-12"}`, map[string]string{"targetMonth": "invalid"}},
		"month year high": {`{"name":"a","targetCents":1,"targetMonth":"2101-01"}`, map[string]string{"targetMonth": "invalid"}},
		"two wrong":       {`{"name":"","targetCents":0,"targetMonth":"x"}`, map[string]string{"name": "required", "targetCents": "invalid", "targetMonth": "invalid"}},
	} {
		res := ana.SendRaw(http.MethodPost, "/me/finance/goals", []byte(c.raw))
		if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid goal" {
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
	// Both ends of the target range are accepted; an extra key and a wrong name type fail the decode.
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", ok("targetCents", 1)), http.StatusCreated)
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", ok("targetCents", int64(1_000_000_000_000))), http.StatusCreated)
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", ok("name", strings.Repeat("a", 60))), http.StatusCreated)
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", ok("x", 1)), http.StatusBadRequest)
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", ok("name", 5)), http.StatusBadRequest)
	// An update validates the same way.
	id := newGoal(t, ana, "B")
	apitest.ExpectStatus(t, ana.Put("/me/finance/goals/"+id, ok("targetCents", 0)), http.StatusBadRequest)
}
