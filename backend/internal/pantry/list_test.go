package pantry_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce/nfcetest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

const listPath = "/me/finance/pantry/list"

func shoppingList(t *testing.T, c *apitest.Client) apitest.Response {
	t.Helper()
	r := c.Get(listPath)
	apitest.ExpectStatus(t, r, http.StatusOK)
	return r
}

func rowsOf(r apitest.Response) []map[string]any {
	var out []map[string]any
	for _, l := range r.Body["items"].([]any) {
		out = append(out, l.(map[string]any))
	}
	return out
}

func runOut(t *testing.T, c *apitest.Client, id string) {
	t.Helper()
	apitest.ExpectStatus(t, c.Post("/me/finance/pantry/items/"+id+"/run-outs", nil), http.StatusNoContent)
}

func TestListHoldsRanOutAndFixedItemsOnly(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	app.Clock.Set(time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC))
	margarina := add(t, ana, map[string]any{"name": "Margarina"})
	cafe := add(t, ana, map[string]any{"name": "Café"})
	add(t, ana, map[string]any{"name": "Arroz"}) // in stock, not fixed: absent
	sal := add(t, ana, map[string]any{"name": "Sal"})
	apitest.ExpectStatus(t, patch(ana, sal, map[string]any{"fixed": true}), http.StatusOK)

	rec := post(t, ana, nfcetest.Key, http.StatusCreated)
	apitest.ExpectStatus(t, putLine(ana, rec.Body["id"].(string), 1, map[string]any{"itemId": margarina}), http.StatusOK)
	apitest.ExpectStatus(t, putLine(ana, rec.Body["id"].(string), 3, map[string]any{"itemId": cafe}), http.StatusOK)
	runOut(t, ana, margarina) // after the 2026-11-18 purchase
	runOut(t, ana, cafe)

	r := shoppingList(t, ana)
	got := rowsOf(r)
	if len(got) != 3 || got[0]["name"] != "Café" || got[1]["name"] != "Margarina" || got[2]["name"] != "Sal" {
		t.Fatalf("list = %s", r.Raw)
	}
	l1, l3 := lines(rec)[0], lines(rec)[2]
	// Quantity and price default to the last bought; the 1,496 kg weighed line prices to the rounded cent.
	if got[1]["quantityMilli"] != l1["quantityMilli"] || got[1]["unitPriceCents"] != l1["unitPriceCents"] || got[1]["unit"] != l1["unit"] {
		t.Errorf("margarina = %v, line = %v", got[1], l1)
	}
	if got[0]["quantityMilli"] != float64(1496) || got[0]["unitPriceCents"] != float64(5990) || got[0]["priceCents"] != float64(8961) || got[0]["unit"] != "KG9" {
		t.Errorf("cafe = %v, line = %v", got[0], l3)
	}
	// Added by hand: one unit, no price, UN.
	if got[2]["quantityMilli"] != float64(1000) || got[2]["unit"] != "UN" || got[2]["fixed"] != true {
		t.Errorf("sal = %v", got[2])
	}
	if _, has := got[2]["unitPriceCents"]; has {
		t.Errorf("sal has a price: %v", got[2])
	}
	if _, has := got[2]["priceCents"]; has {
		t.Errorf("sal has a row price: %v", got[2])
	}
	want := got[0]["priceCents"].(float64) + got[1]["priceCents"].(float64)
	if r.Body["expectedTotalCents"] != want {
		t.Errorf("total = %v, want %v", r.Body["expectedTotalCents"], want)
	}
}

func TestEmptyListTotalsZero(t *testing.T) {
	t.Parallel()
	_, ana, _ := startReceipts(t)
	r := shoppingList(t, ana)
	if len(rowsOf(r)) != 0 || r.Body["expectedTotalCents"] != float64(0) {
		t.Errorf("list = %s", r.Raw)
	}
	if _, has := r.Body["groceriesLeftCents"]; has {
		t.Errorf("groceriesLeftCents present with no limit: %s", r.Raw)
	}
}

func startWithTransactions(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"), apitest.WithPluggy())
	ana := app.SignInAs("ana@example.com")
	creds := map[string]string{"clientId": pluggytest.ClientID, "clientSecret": pluggytest.ClientSecret}
	apitest.ExpectStatus(t, ana.Put("/me/finance/credentials", creds), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Post("/me/finance/items", map[string]string{"itemId": pluggytest.ItemID}), http.StatusOK)
	app.Clock.Set(time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC))
	app.RunFinanceSync(t) // import the fixtures now, so later reads see a settled month
	return app, ana
}

func groceriesSpent(t *testing.T, c *apitest.Client) float64 {
	t.Helper()
	r := c.Get("/me/finance/transactions?month=2026-11")
	apitest.ExpectStatus(t, r, http.StatusOK)
	for _, c := range r.Body["categories"].([]any) {
		if c := c.(map[string]any); c["category"] == "groceries" {
			return c["spentCents"].(float64)
		}
	}
	return 0
}

func TestGroceriesLeftEqualsTheSpendingCategoriesFigure(t *testing.T) {
	t.Parallel()
	app, ana := startWithTransactions(t)
	spend := func(cents int, day string) {
		t.Helper()
		if _, err := app.DB.Exec(t.Context(), `
			INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
				merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
			SELECT user_id, id, 'g-' || $1::text, $3::date, -$2::bigint, 'BRL', 'Mercado', '', 'expense', 'auto', 'groceries', 'fallback', now(), now()
			FROM finance_sources WHERE kind = 'checking' ORDER BY id LIMIT 1`, day, cents, day); err != nil {
			t.Fatal(err)
		}
	}
	if _, has := shoppingList(t, ana).Body["groceriesLeftCents"]; has {
		t.Fatal("groceriesLeftCents present before a limit is set")
	}

	// A limit and no groceries spent yet: left equals the limit.
	apitest.ExpectStatus(t, ana.Put("/me/finance/budgets/groceries", map[string]any{"limitCents": 40000}), http.StatusNoContent)
	app.Clock.Set(time.Date(2026, 12, 5, 12, 0, 0, 0, time.UTC)) // December has no groceries spend yet
	if r := shoppingList(t, ana); r.Body["groceriesLeftCents"] != float64(40000) {
		t.Errorf("no spend: %s", r.Raw)
	}
	app.Clock.Set(time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC))

	before := groceriesSpent(t, ana)
	spend(12345, "2026-11-05")
	spend(1000, "2026-10-10") // another month
	spent := groceriesSpent(t, ana)
	if spent != before+12345 {
		t.Fatalf("Spending Categories groceries = %v, want %v", spent, before+12345)
	}
	if r := shoppingList(t, ana); r.Body["groceriesLeftCents"] != 40000-spent {
		t.Errorf("left = %v, want %v", r.Body["groceriesLeftCents"], 40000-spent)
	}

	// Over the limit: negative.
	apitest.ExpectStatus(t, ana.Put("/me/finance/budgets/groceries", map[string]any{"limitCents": 10000}), http.StatusNoContent)
	if r := shoppingList(t, ana); r.Body["groceriesLeftCents"] != 10000-spent || spent <= 10000 {
		t.Errorf("over: %s", r.Raw)
	}

	apitest.ExpectStatus(t, ana.Put("/me/finance/budgets/groceries", map[string]any{"limitCents": nil}), http.StatusNoContent)
	if _, has := shoppingList(t, ana).Body["groceriesLeftCents"]; has {
		t.Error("groceriesLeftCents present after the limit was removed")
	}
}

func TestListEditsPersistAndClearOnPurchase(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	app.Clock.Set(time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC))
	a := add(t, ana, map[string]any{"name": "Açúcar"})
	b := add(t, ana, map[string]any{"name": "Biscoito"})
	c := add(t, ana, map[string]any{"name": "Café"})
	for _, id := range []string{a, b, c} {
		runOut(t, ana, id)
	}
	apitest.ExpectStatus(t, ana.Put(listPath+"/"+a, map[string]any{"quantityMilli": 3000}), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put(listPath+"/"+b, map[string]any{"removed": true}), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put(listPath+"/"+b, map[string]any{"quantityMilli": 2000}), http.StatusNoContent) // stays removed
	for i := 0; i < 2; i++ {                                                                                      // across reads
		got := rowsOf(shoppingList(t, ana))
		if len(got) != 2 || got[0]["itemId"] != a || got[0]["quantityMilli"] != float64(3000) || got[1]["itemId"] != c {
			t.Fatalf("read %d: list = %v", i, got)
		}
	}

	apitest.ExpectStatus(t, ana.Put(listPath+"/"+c, map[string]any{"quantityMilli": 2000}), http.StatusNoContent)

	// Buying A (a saved match) and B (a manual match) clears their edits; they were bought after running out, so they leave the list.
	rec := post(t, ana, nfcetest.Key, http.StatusCreated)
	id := rec.Body["id"].(string)
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": a}), http.StatusOK)
	apitest.ExpectStatus(t, putLine(ana, id, 2, map[string]any{"itemId": b}), http.StatusOK)
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_list_edits WHERE item_id IN ($1, $2)`, a, b); n != 0 {
		t.Errorf("edits left after matching = %d, want 0", n)
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_list_edits WHERE item_id = $1`, c); n != 1 {
		// C was never bought: matching other lines must not clear its edit.
		t.Errorf("edits for café = %d, want 1", n)
	}

	// B runs out again on a later day: it is back on the list, no longer removed.
	app.Clock.Set(time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC))
	runOut(t, ana, b)
	if got := rowsOf(shoppingList(t, ana)); len(got) != 2 || got[0]["itemId"] != b || got[0]["quantityMilli"] == float64(2000) {
		t.Errorf("after buying and running out again = %v", got)
	}

	// The saved-match path clears an edit too: a second trip matches A on its own.
	apitest.ExpectStatus(t, ana.Put(listPath+"/"+a, map[string]any{"quantityMilli": 5000}), http.StatusNoContent)
	post(t, ana, nfcetest.OtherKey, http.StatusCreated)
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_list_edits WHERE item_id = $1`, a); n != 0 {
		t.Errorf("edit left after a saved match = %d, want 0", n)
	}
}

func TestListEditValidation(t *testing.T) {
	t.Parallel()
	_, ana, bia := startReceipts(t)
	id := add(t, ana, map[string]any{"name": "Café"})
	cases := []struct {
		name string
		body any
		want int
	}{
		{"quantity", map[string]any{"quantityMilli": 1}, 204},
		{"quantity at the ceiling", map[string]any{"quantityMilli": 1_000_000}, 204},
		{"removed", map[string]any{"removed": true}, 204},
		{"zero quantity", map[string]any{"quantityMilli": 0}, 400},
		{"negative quantity", map[string]any{"quantityMilli": -5}, 400},
		{"over the ceiling", map[string]any{"quantityMilli": 1_000_001}, 400},
		{"fractional", map[string]any{"quantityMilli": 1.5}, 400},
		{"removed false", map[string]any{"removed": false}, 400},
		{"both", map[string]any{"quantityMilli": 1000, "removed": true}, 400},
		{"neither", map[string]any{}, 400},
		{"extra key", map[string]any{"quantityMilli": 1000, "x": 1}, 400},
		{"wrong type", map[string]any{"quantityMilli": "1"}, 400},
	}
	for _, c := range cases {
		if r := ana.Put(listPath+"/"+id, c.body); r.Status != c.want {
			t.Errorf("%s: status %d, want %d", c.name, r.Status, c.want)
		}
	}
	for name, path := range map[string]string{"not a uuid": listPath + "/x", "unknown": listPath + "/6f1c2a3e-0000-4000-8000-000000000000", "another User's": listPath + "/" + id} {
		c := ana
		if name == "another User's" {
			c = bia
		}
		if r := c.Put(path, map[string]any{"removed": true}); r.Status != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", name, r.Status)
		}
	}
}

func TestPriceHistoryAndAverageDuration(t *testing.T) {
	t.Parallel()
	app, ana, bia := startReceipts(t)
	cafe := add(t, ana, map[string]any{"name": "Café"})
	if r := ana.Get("/me/finance/pantry/items/" + cafe); r.Status != http.StatusOK || r.Body["avgDurationDays"] != nil || len(r.Body["prices"].([]any)) != 0 {
		t.Fatalf("never bought = %s", r.Raw)
	}
	first := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	apitest.ExpectStatus(t, putLine(ana, first, 1, map[string]any{"itemId": cafe}), http.StatusOK)
	// The second trip is dated later, at another store and price.
	second := post(t, ana, nfcetest.OtherKey, http.StatusCreated).Body["id"].(string)
	if _, err := app.DB.Exec(t.Context(), `UPDATE finance_pantry_receipts SET issued_on = '2026-11-28', store_name = 'ASSAI' WHERE id = $1`, second); err != nil {
		t.Fatal(err)
	}
	if _, err := app.DB.Exec(t.Context(), `UPDATE finance_pantry_receipt_lines SET unit_price_cents = 777 WHERE receipt_id = $1 AND line_no = 1`, second); err != nil {
		t.Fatal(err)
	}
	app.Clock.Set(time.Date(2026, 11, 28, 12, 0, 0, 0, time.UTC)) // a run-out 10 days after the first purchase
	runOut(t, ana, cafe)

	r := ana.Get("/me/finance/pantry/items/" + cafe)
	apitest.ExpectStatus(t, r, http.StatusOK)
	prices := r.Body["prices"].([]any)
	if len(prices) != 2 {
		t.Fatalf("detail = %s", r.Raw)
	}
	newest, oldest := prices[0].(map[string]any), prices[1].(map[string]any)
	if newest["issuedOn"] != "2026-11-28" || newest["unitPriceCents"] != float64(777) || newest["storeName"] != "ASSAI" || oldest["issuedOn"] != "2026-11-18" || oldest["storeName"] != "ATACADAO S.A." {
		t.Errorf("prices = %v", prices)
	}
	if r.Body["avgDurationDays"] != float64(10) || r.Body["item"].(map[string]any)["id"] != cafe {
		t.Errorf("detail = %s", r.Raw)
	}

	// GET pantry carries the latest price and the average too.
	got := items(t, ana)[0]
	if got["lastPriceCents"] != float64(777) || got["avgDurationDays"] != float64(10) {
		t.Errorf("pantry item = %v", got)
	}

	if r := bia.Get("/me/finance/pantry/items/" + cafe); r.Status != http.StatusNotFound {
		t.Errorf("Bia on Ana's item: %d, want 404", r.Status)
	}
	if r := ana.Get("/me/finance/pantry/items/nope"); r.Status != http.StatusNotFound {
		t.Errorf("not a uuid: %d, want 404", r.Status)
	}
}

func TestPantryReadAndListUseAFixedNumberOfQueries(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	one := add(t, ana, map[string]any{"name": "Café"})
	runOut(t, ana, one)
	few := app.QueriesFor(func() { shoppingList(t, ana); items(t, ana) })
	for i := 0; i < 5; i++ {
		runOut(t, ana, add(t, ana, map[string]any{"name": fmt.Sprintf("Item %d", i)}))
	}
	if many := app.QueriesFor(func() { shoppingList(t, ana); items(t, ana) }); many != few {
		t.Errorf("queries = %d with six items, %d with one", many, few)
	}
}
