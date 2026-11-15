package finance_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// items reads items[] of GET /me/finance.
func items(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	res := c.Get("/me/finance")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /me/finance = %d %s", res.Status, res.Raw)
	}
	list, ok := res.Body["items"].([]any)
	if !ok {
		t.Fatalf("items = %v, want a list, never null: %s", res.Body["items"], res.Raw)
	}
	out := make([]map[string]any, len(list))
	for i, it := range list {
		out[i] = it.(map[string]any)
	}
	return out
}

func TestItemsStatus(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name, status, exec string
		synced             bool
		wantStatus         string
		wantBank           any
	}{
		{"working", "UPDATED", "SUCCESS", true, "ok", "Pluggy Bank"},
		{"login error", "LOGIN_ERROR", "INVALID_CREDENTIALS", true, "reconnect", "Pluggy Bank"},
		{"outdated with a credentials error", "OUTDATED", "ACCOUNT_LOCKED", true, "reconnect", "Pluggy Bank"},
		{"outdated with a bank outage", "OUTDATED", "SITE_NOT_AVAILABLE", true, "ok", "Pluggy Bank"},
		{"never synced since the column existed", "", "", false, "ok", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, users := startSync(t, []string{"ana@example.com"})
			ana := users["ana@example.com"]
			if tc.synced {
				app.Pluggy.SetItemStatus(tc.status, tc.exec)
				app.RunFinanceSync(t)
			} else if _, err := app.DB.Exec(context.Background(), `UPDATE finance_items SET status = NULL, connector_name = NULL`); err != nil {
				t.Fatal(err) // connecting stores the status too; this is an Item from before the columns
			}
			got := items(t, ana)
			if len(got) != 1 || got[0]["status"] != tc.wantStatus || got[0]["bankName"] != tc.wantBank || got[0]["products"] != float64(2) {
				t.Fatalf("items = %v, want one %q item of bank %v with 2 products", got, tc.wantStatus, tc.wantBank)
			}
			if id, _ := got[0]["id"].(string); id == "" || id == "72ff2ef2-60b0-42d5-9514-7b9a55eb4267" {
				t.Errorf("id = %v, want the app's own item id, not Pluggy's", got[0]["id"])
			}
		})
	}
}

func TestItemsEmptyWithoutItems(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	if got := items(t, app.SignInAs("ana@example.com")); len(got) != 0 {
		t.Errorf("items = %v, want empty", got)
	}
}

func TestItemsCountOnlyTheirOwnSourcesAndUser(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	// A second Item of Ana's with one Source, so counts must not mix.
	if _, err := app.DB.Exec(context.Background(), `
		WITH i AS (INSERT INTO finance_items (user_id, pluggy_item_id, connected_at, connector_name, status)
			SELECT id, 'second', now(), 'Other Bank', 'LOGIN_ERROR' FROM users WHERE email = 'ana@example.com' RETURNING id, user_id)
		INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency)
			SELECT user_id, id, 'acc', 'checking', 'Conta', 'BRL' FROM i`); err != nil {
		t.Fatal(err)
	}
	byBank := map[any]map[string]any{}
	for _, it := range items(t, users["ana@example.com"]) {
		byBank[it["bankName"]] = it
	}
	if len(byBank) != 2 || byBank["Other Bank"]["products"] != float64(1) || byBank["Other Bank"]["status"] != "reconnect" || byBank["Pluggy Bank"]["products"] != float64(2) {
		t.Errorf("ana items = %v, want a 1-product reconnect and a 2-product ok", byBank)
	}
	if got := items(t, users["bob@example.com"]); len(got) != 1 || got[0]["products"] != float64(2) {
		t.Errorf("bob items = %v, want only his own", got)
	}
}

func TestSyncStoresItemStatusAndName(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.Pluggy.SetItemStatus("LOGIN_ERROR", "INVALID_CREDENTIALS")
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_items WHERE status = 'LOGIN_ERROR' AND connector_name = 'Pluggy Bank'`); n != 1 {
		t.Errorf("items with the stored status and name = %d, want 1", n)
	}
}

func TestSyncFinishesWhenGetItemFails(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	// The Item was stored by connecting; clear it so only the sync could fill it.
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_items SET status = NULL, connector_name = NULL`); err != nil {
		t.Fatal(err)
	}
	app.Pluggy.Fail("/items/"+"72ff2ef2-60b0-42d5-9514-7b9a55eb4267", 500)
	if sum := app.RunFinanceSync(t); sum.Synced != 1 || sum.Failed != 0 {
		t.Errorf("summary = %+v, want the Item synced", sum)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d, want %d", n, fixtureRows)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_items WHERE status IS NULL`); n != 1 {
		t.Errorf("status stayed null for %d items, want 1", n)
	}
}
