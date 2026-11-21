package pantry_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func start(t *testing.T) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bia@example.com"))
	return app, app.SignInAs("ana@example.com"), app.SignInAs("bia@example.com")
}

func add(t *testing.T, c *apitest.Client, body map[string]any) string {
	t.Helper()
	r := c.Post("/me/finance/pantry/items", body)
	apitest.ExpectStatus(t, r, http.StatusCreated)
	return r.Body["id"].(string)
}

func items(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	r := c.Get("/me/finance/pantry")
	apitest.ExpectStatus(t, r, http.StatusOK)
	var out []map[string]any
	for _, it := range r.Body["items"].([]any) {
		out = append(out, it.(map[string]any))
	}
	return out
}

func patch(c *apitest.Client, id string, body any) apitest.Response {
	return c.Do(http.MethodPatch, "/me/finance/pantry/items/"+id, body, nil)
}

func TestAddByNameThenWithBrandReadsBackInStock(t *testing.T) {
	t.Parallel()
	_, ana, _ := start(t)
	r := ana.Post("/me/finance/pantry/items", map[string]any{"name": "  Café "})
	apitest.ExpectStatus(t, r, http.StatusCreated)
	if r.Body["name"] != "Café" || r.Body["state"] != "in_stock" || r.Body["fixed"] != false || r.Body["preferredBrand"] != nil {
		t.Errorf("created = %s", r.Raw)
	}
	add(t, ana, map[string]any{"name": "Arroz", "preferredBrand": "Tio João"})
	got := items(t, ana)
	if len(got) != 2 || got[0]["name"] != "Arroz" || got[0]["preferredBrand"] != "Tio João" || got[0]["state"] != "in_stock" || got[0]["ranOutOn"] != nil || got[1]["name"] != "Café" {
		t.Errorf("pantry = %v", got)
	}
}

func TestAddValidation(t *testing.T) {
	t.Parallel()
	_, ana, _ := start(t)
	add(t, ana, map[string]any{"name": "a", "preferredBrand": ""})
	add(t, ana, map[string]any{"name": strings.Repeat("é", 60), "preferredBrand": strings.Repeat("é", 60)})
	for name, body := range map[string]any{
		"empty name":         map[string]any{"name": " "},
		"long name":          map[string]any{"name": strings.Repeat("é", 61)},
		"long brand":         map[string]any{"name": "x", "preferredBrand": strings.Repeat("é", 61)},
		"extra key":          map[string]any{"name": "x", "price": 1},
		"wrong type":         map[string]any{"name": 5},
		"missing name":       map[string]any{},
		"control char":       map[string]any{"name": "a\x00b"},
		"brand control char": map[string]any{"name": "x", "preferredBrand": "a\nb"},
	} {
		if r := ana.Post("/me/finance/pantry/items", body); r.Status != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, r.Status)
		}
	}
	// "a" with an empty brand stored no brand.
	if got := items(t, ana)[0]; got["name"] != "a" || got["preferredBrand"] != nil {
		t.Errorf("empty brand = %v, want none", got)
	}
}

func TestDuplicateNameIs409OnAddAndRename(t *testing.T) {
	t.Parallel()
	_, ana, bia := start(t)
	add(t, ana, map[string]any{"name": "Café"})
	other := add(t, ana, map[string]any{"name": "Leite"})
	r := ana.Post("/me/finance/pantry/items", map[string]any{"name": "CAFÉ"})
	if r.Status != http.StatusConflict || r.Body["error"] != "name_taken" {
		t.Errorf("add duplicate = %d %s", r.Status, r.Raw)
	}
	r = patch(ana, other, map[string]any{"name": "café"})
	if r.Status != http.StatusConflict || r.Body["error"] != "name_taken" {
		t.Errorf("rename duplicate = %d %s", r.Status, r.Raw)
	}
	add(t, bia, map[string]any{"name": "Café"}) // another User may use the name
}

func TestRanOutUsesSaoPauloDayAndUndo(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	app.Clock.Set(time.Date(2026, 11, 20, 1, 0, 0, 0, time.UTC)) // 22:00 on the 19th in São Paulo
	id := add(t, ana, map[string]any{"name": "Café"})

	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+id+"/run-outs", nil), http.StatusNoContent)
	got := items(t, ana)[0]
	if got["state"] != "ran_out" || got["ranOutOn"] != "2026-11-19" {
		t.Errorf("after ran out = %v", got)
	}
	// A second tap adds nothing.
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+id+"/run-outs", nil), http.StatusNoContent)
	if n := apitest.Count(t, app, `SELECT count(*) FROM finance_pantry_run_outs WHERE item_id = $1`, id); n != 1 {
		t.Errorf("run-outs = %d, want 1", n)
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/pantry/items/"+id+"/run-outs/latest"), http.StatusNoContent)
	if got := items(t, ana)[0]; got["state"] != "in_stock" || got["ranOutOn"] != nil {
		t.Errorf("after undo = %v", got)
	}
	r := ana.Delete("/me/finance/pantry/items/" + id + "/run-outs/latest")
	if r.Status != http.StatusConflict || r.Body["error"] != "not_ran_out" {
		t.Errorf("undo in stock = %d %s", r.Status, r.Raw)
	}
}

func TestUndoRemovesOnlyTheLatestRunOut(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	id := add(t, ana, map[string]any{"name": "Café"})
	for _, d := range []string{"2026-01-01", "2026-02-01"} {
		if _, err := app.DB.Exec(context.Background(), `INSERT INTO finance_pantry_run_outs (id, user_id, item_id, ran_out_on, created_at)
			SELECT gen_random_uuid(), user_id, id, $2::date, now() FROM finance_pantry_items WHERE id = $1`, id, d); err != nil {
			t.Fatal(err)
		}
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/pantry/items/"+id+"/run-outs/latest"), http.StatusNoContent)
	if got := items(t, ana)[0]; got["ranOutOn"] != "2026-01-01" {
		t.Errorf("after undoing the latest = %v", got)
	}
}

func TestRenameBrandAndFixed(t *testing.T) {
	t.Parallel()
	_, ana, _ := start(t)
	id := add(t, ana, map[string]any{"name": "Café", "preferredBrand": "Pilão"})
	r := patch(ana, id, map[string]any{"fixed": true})
	if r.Status != http.StatusOK || r.Body["fixed"] != true || r.Body["name"] != "Café" || r.Body["preferredBrand"] != "Pilão" {
		t.Errorf("set fixed = %d %s", r.Status, r.Raw)
	}
	r = patch(ana, id, map[string]any{"fixed": false, "name": "Café Torrado", "preferredBrand": nil})
	if r.Status != http.StatusOK || r.Body["fixed"] != false || r.Body["name"] != "Café Torrado" || r.Body["preferredBrand"] != nil {
		t.Errorf("clear fixed, rename, clear brand = %d %s", r.Status, r.Raw)
	}
	r = patch(ana, id, map[string]any{"preferredBrand": "3 Corações"})
	if r.Body["preferredBrand"] != "3 Corações" || r.Body["name"] != "Café Torrado" {
		t.Errorf("set brand = %s", r.Raw)
	}
	for name, body := range map[string]any{
		"empty":              map[string]any{},
		"extra key":          map[string]any{"state": "ran_out"},
		"empty name":         map[string]any{"name": ""},
		"long name":          map[string]any{"name": strings.Repeat("x", 61)},
		"long brand":         map[string]any{"preferredBrand": strings.Repeat("x", 61)},
		"null name":          map[string]any{"name": nil},
		"fixed type":         map[string]any{"fixed": "yes"},
		"brand type":         map[string]any{"preferredBrand": 5},
		"control char":       map[string]any{"name": "a\x00b"},
		"brand control char": map[string]any{"preferredBrand": "a\tb"},
	} {
		if r := patch(ana, id, body); r.Status != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, r.Status)
		}
	}
}

func TestDeleteRemovesItemAndRunOuts(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	id := add(t, ana, map[string]any{"name": "Café"})
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+id+"/run-outs", nil), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/pantry/items/"+id), http.StatusNoContent)
	if n := apitest.Count(t, app, `SELECT (SELECT count(*) FROM finance_pantry_items) + (SELECT count(*) FROM finance_pantry_run_outs)`); n != 0 {
		t.Errorf("rows left = %d", n)
	}
	if len(items(t, ana)) != 0 {
		t.Error("item still listed")
	}
}

func TestOneUserNeverSeesOrChangesAnothers(t *testing.T) {
	t.Parallel()
	app, ana, bia := start(t)
	id := add(t, ana, map[string]any{"name": "Café"})
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+id+"/run-outs", nil), http.StatusNoContent)
	if got := items(t, bia); len(got) != 0 {
		t.Errorf("Bia sees %v", got)
	}
	base := "/me/finance/pantry/items/" + id
	for name, r := range map[string]apitest.Response{
		"patch":   patch(bia, id, map[string]any{"name": "Roubado"}),
		"delete":  bia.Delete(base),
		"run-out": bia.Post(base+"/run-outs", nil),
		"undo":    bia.Delete(base + "/run-outs/latest"),
	} {
		if r.Status != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", name, r.Status)
		}
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM finance_pantry_items WHERE id = $1 AND name = 'Café'`, id); n != 1 {
		t.Error("Ana's item changed")
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM finance_pantry_run_outs WHERE item_id = $1`, id); n != 1 {
		t.Errorf("run-outs = %d, want Ana's 1", n)
	}
}

func TestANonUuidIdIs404(t *testing.T) {
	t.Parallel()
	_, ana, _ := start(t)
	base := "/me/finance/pantry/items/nope"
	for name, r := range map[string]apitest.Response{
		"patch": patch(ana, "nope", map[string]any{"fixed": true}), "delete": ana.Delete(base),
		"run-out": ana.Post(base+"/run-outs", nil), "undo": ana.Delete(base + "/run-outs/latest"),
	} {
		if r.Status != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", name, r.Status)
		}
	}
}

func TestOffTheAllowlistIs403OnEveryRoute(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	id := add(t, ana, map[string]any{"name": "Café"})
	cat := app.SignInAs("cat@example.com")
	base := "/me/finance/pantry/items/" + id
	routes := []struct{ method, path string }{
		{"GET", "/me/finance/pantry"}, {"POST", "/me/finance/pantry/items"},
		{"PATCH", base}, {"DELETE", base}, {"POST", base + "/run-outs"}, {"DELETE", base + "/run-outs/latest"},
	}
	ran := 0
	for _, rt := range routes {
		if r := cat.Do(rt.method, rt.path, map[string]any{"name": "x"}, nil); r.Status != http.StatusForbidden {
			t.Errorf("%s %s: status %d, want 403", rt.method, rt.path, r.Status)
		}
		ran++
	}
	if ran != len(routes) {
		t.Fatalf("ran %d routes, want %d", ran, len(routes))
	}
}
