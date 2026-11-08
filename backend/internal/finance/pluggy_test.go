package finance_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

const ana, bob = "ana@example.com", "bob@example.com"

func startPluggy(t *testing.T, opts ...apitest.Option) (*apitest.App, *apitest.Client) {
	t.Helper()
	opts = append(opts, apitest.WithFinance(apitest.FinanceTestKey(), ana, bob), apitest.WithPluggy())
	app := apitest.Start(t, opts...)
	return app, app.SignInAs(ana)
}

func saveRealCredentials(t *testing.T, c *apitest.Client) {
	t.Helper()
	res := c.Put("/me/finance/credentials", map[string]any{"clientId": pluggytest.ClientID, "clientSecret": pluggytest.ClientSecret})
	if res.Status != http.StatusNoContent {
		t.Fatalf("save credentials = %d %s", res.Status, res.Raw)
	}
}

func count(t *testing.T, app *apitest.App, table string) (n int) {
	t.Helper()
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM `+table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestConnectToken(t *testing.T) {
	t.Parallel()
	app, c := startPluggy(t)

	if res := c.Post("/me/finance/connect-token", nil); res.Status != http.StatusConflict || res.Body["error"] != "no credentials" {
		t.Errorf("without credentials = %d %s, want 409", res.Status, res.Raw)
	}

	c.Put("/me/finance/credentials", map[string]any{"clientId": pluggytest.ClientID, "clientSecret": "wrong-secret"})
	if res := c.Post("/me/finance/connect-token", nil); res.Status != http.StatusUnprocessableEntity || res.Body["error"] != "pluggy_credentials_rejected" {
		t.Errorf("wrong credentials = %d %s, want 422", res.Status, res.Raw)
	}

	saveRealCredentials(t, c)
	res := c.Post("/me/finance/connect-token", nil)
	if res.Status != http.StatusOK || res.Body["connectToken"] != pluggytest.ConnectToken || res.Body["includeSandbox"] != true {
		t.Errorf("connect token = %d %s", res.Status, res.Raw)
	}
	if strings.Contains(string(res.Raw), pluggytest.APIKey) || app.Logs.Contains(pluggytest.APIKey) {
		t.Error("the API key leaked")
	}
}

func TestConnectTokenOmitsSandboxInProduction(t *testing.T) {
	t.Parallel()
	_, c := startPluggy(t, apitest.WithEnvironment("production"))
	saveRealCredentials(t, c)
	if res := c.Post("/me/finance/connect-token", nil); res.Body["includeSandbox"] != false {
		t.Errorf("production = %s, want includeSandbox false", res.Raw)
	}
}

func TestPluggyFailureIsCalmAndLeaksNothing(t *testing.T) {
	t.Parallel()
	app, c := startPluggy(t)
	saveRealCredentials(t, c)
	app.Pluggy.Fail("/connect_token", http.StatusInternalServerError)
	app.Pluggy.Fail("/items/"+pluggytest.ItemID, http.StatusBadGateway)

	responses := []apitest.Response{
		c.Post("/me/finance/connect-token", nil),
		c.Post("/me/finance/items", map[string]any{"itemId": pluggytest.ItemID}),
	}
	for _, res := range responses {
		if res.Status != http.StatusBadGateway || res.Body["error"] != "pluggy unavailable" {
			t.Errorf("failure = %d %s, want 502 pluggy unavailable", res.Status, res.Raw)
		}
		for _, secret := range []string{pluggytest.ClientID, pluggytest.ClientSecret, pluggytest.APIKey, pluggytest.FailBody} {
			if strings.Contains(string(res.Raw), secret) || app.Logs.Contains(secret) {
				t.Errorf("%q leaked into a response or the logs", secret)
			}
		}
	}
}

func TestConnectItemCreatesSourcesOnce(t *testing.T) {
	t.Parallel()
	app, c := startPluggy(t)
	saveRealCredentials(t, c)
	body := map[string]any{"itemId": pluggytest.ItemID}

	res := c.Post("/me/finance/items", body)
	if res.Status != http.StatusOK {
		t.Fatalf("connect = %d %s", res.Status, res.Raw)
	}
	sources, _ := res.Body["sources"].([]any)
	kinds := map[string]string{}
	for _, s := range sources {
		m := s.(map[string]any)
		kinds[m["name"].(string)] = m["kind"].(string) + "/" + m["currency"].(string)
	}
	if len(sources) != 2 || kinds["Conta Corrente"] != "checking/BRL" || len(kinds) != 2 {
		t.Errorf("sources = %s", res.Raw)
	}
	if !strings.Contains(string(res.Raw), `"kind":"credit_card"`) {
		t.Errorf("no credit_card source in %s", res.Raw)
	}
	if res := c.Post("/me/finance/items", body); res.Status != http.StatusOK {
		t.Fatalf("repeat = %d %s", res.Status, res.Raw)
	}
	if items, sources := count(t, app, "finance_items"), count(t, app, "finance_sources"); items != 1 || sources != 2 {
		t.Errorf("after repeat: %d items, %d sources, want 1 and 2", items, sources)
	}
	var complete bool
	if err := app.DB.QueryRow(context.Background(), `SELECT import_complete FROM finance_items`).Scan(&complete); err != nil || complete {
		t.Errorf("import_complete = %v, %v, want false", complete, err)
	}

	st := c.Get("/me/finance")
	if st.Body["importing"] != true || st.Body["lastSyncedAt"] != nil || len(st.Body["sources"].([]any)) != 2 || st.Body["configured"] != true {
		t.Errorf("status = %s", st.Raw)
	}
	other := app.SignInAs(bob).Get("/me/finance")
	if len(other.Body["sources"].([]any)) != 0 || other.Body["importing"] != false {
		t.Errorf("another User sees %s", other.Raw)
	}
}

func TestConnectItemRefusals(t *testing.T) {
	t.Parallel()
	app, c := startPluggy(t)
	saveRealCredentials(t, c)

	if res := c.Post("/me/finance/items", map[string]any{"itemId": "not-a-uuid"}); res.Status != http.StatusBadRequest {
		t.Errorf("bad id = %d %s, want 400", res.Status, res.Raw)
	}
	if res := c.Post("/me/finance/items", map[string]any{"itemId": pluggytest.UnknownItemID}); res.Status != http.StatusNotFound || res.Body["error"] != "item not found" {
		t.Errorf("unknown item = %d %s, want 404", res.Status, res.Raw)
	}
	if n := count(t, app, "finance_items"); n != 0 {
		t.Errorf("%d items stored after refusals", n)
	}
	noCreds := app.SignInAs(bob)
	if res := noCreds.Post("/me/finance/items", map[string]any{"itemId": pluggytest.ItemID}); res.Status != http.StatusConflict {
		t.Errorf("without credentials = %d %s, want 409", res.Status, res.Raw)
	}
}

func TestFinanceRowsGoWithTheUser(t *testing.T) {
	t.Parallel()
	app, c := startPluggy(t)
	saveRealCredentials(t, c)
	c.Post("/me/finance/items", map[string]any{"itemId": pluggytest.ItemID})
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM users`); err != nil {
		t.Fatal(err)
	}
	if n := count(t, app, "finance_items") + count(t, app, "finance_sources"); n != 0 {
		t.Errorf("%d finance rows survived the User", n)
	}
}
