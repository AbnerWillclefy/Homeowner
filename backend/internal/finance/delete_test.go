package finance_test

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// rowsOf counts one User's rows in every finance table, in financeTables order.
func rowsOf(t *testing.T, app *apitest.App, userID string) []int64 {
	t.Helper()
	var out []int64
	for _, tbl := range finance.FinanceTables {
		out = append(out, scalar(t, app, fmt.Sprintf(`SELECT count(*) FROM %s WHERE user_id = $1`, tbl), userID))
	}
	return out
}

func userID(t *testing.T, app *apitest.App, email string) string {
	t.Helper()
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM users WHERE email = $1`, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// twoSynced starts two Users with credentials, an Item, Sources and imported Transactions.
func twoSynced(t *testing.T) (app *apitest.App, ana, bia *apitest.Client, anaID, biaID string) {
	t.Helper()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	app.RunFinanceSync(t)
	anaID, biaID = userID(t, app, "ana@example.com"), userID(t, app, "bia@example.com")
	for _, id := range []string{anaID, biaID} {
		// The sync has no Categorizer here, so seed a correction and a call.
		for _, q := range []string{
			`INSERT INTO finance_merchant_categories (user_id, merchant_key, spending_category, updated_at) VALUES ($1, 'NETFLIX COM', 'leisure', now())`,
			`INSERT INTO finance_llm_calls (user_id, call_date, calls) VALUES ($1, current_date, 1)`,
		} {
			if _, err := app.DB.Exec(context.Background(), q, id); err != nil {
				t.Fatal(err)
			}
		}
		for i, n := range rowsOf(t, app, id) {
			if n == 0 {
				t.Fatalf("setup: %s has no rows for the User", finance.FinanceTables[i])
			}
		}
	}
	return app, users["ana@example.com"], users["bia@example.com"], anaID, biaID
}

func TestDeleteRemovesOnlyTheCallersFinanceData(t *testing.T) {
	t.Parallel()
	app, ana, bia, anaID, biaID := twoSynced(t)
	biaBefore := rowsOf(t, app, biaID)

	apitest.ExpectStatus(t, ana.Delete("/me/finance"), http.StatusNoContent)

	for i, n := range rowsOf(t, app, anaID) {
		if n != 0 {
			t.Errorf("%s: %d rows left", finance.FinanceTables[i], n)
		}
	}
	st := ana.Get("/me/finance")
	if st.Body["configured"] != false || st.Body["importing"] != false || st.Body["lastSyncedAt"] != nil || len(st.Body["sources"].([]any)) != 0 {
		t.Errorf("status after delete = %s, want nothing configured", st.Raw)
	}
	if after := rowsOf(t, app, biaID); !slices.Equal(after, biaBefore) {
		t.Errorf("other User's rows = %v, want %v", after, biaBefore)
	}
	if bia.Get("/me/finance").Body["configured"] != true {
		t.Error("other User lost their configuration")
	}
}

func TestDeleteWithNothingStoredIs204(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	apitest.ExpectStatus(t, app.SignInAs("ana@example.com").Delete("/me/finance"), http.StatusNoContent)
}

func TestLeavingTheHomeKeepsFinanceData(t *testing.T) {
	t.Parallel()
	app, ana, _, anaID, _ := twoSynced(t)
	apitest.ExpectStatus(t, ana.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	before := rowsOf(t, app, anaID)

	apitest.ExpectStatus(t, apitest.LeaveHome(ana), http.StatusNoContent)

	if after := rowsOf(t, app, anaID); !slices.Equal(after, before) {
		t.Errorf("rows after leaving = %v, want %v", after, before)
	}
	if me := ana.Get("/me"); me.Body["finance"] != true {
		t.Errorf("GET /me = %s, want finance true", me.Raw)
	}
}

func TestDeletingTheAccountCascadesToEveryFinanceTable(t *testing.T) {
	t.Parallel()
	app, _, _, anaID, biaID := twoSynced(t)
	biaBefore := rowsOf(t, app, biaID)
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, anaID); err != nil {
		t.Fatal(err)
	}
	for i, n := range rowsOf(t, app, anaID) {
		if n != 0 {
			t.Errorf("%s: %d rows survived the account", finance.FinanceTables[i], n)
		}
	}
	if !slices.Equal(rowsOf(t, app, biaID), biaBefore) {
		t.Error("other User's rows changed")
	}
}

// A table named finance_* with no user_id cascade, or missing from the delete
// list, fails here: later tickets only add their table to financeTables.
func TestEveryFinanceTableCascadesFromUsersAndIsInTheDeleteList(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	rows, err := app.DB.Query(context.Background(), `
		SELECT c.relname,
		       EXISTS (SELECT 1 FROM pg_constraint k
		               WHERE k.conrelid = c.oid AND k.contype = 'f' AND k.confrelid = 'public.users'::regclass
		                 AND k.confdeltype = 'c' AND k.conkey = ARRAY[(SELECT attnum FROM pg_attribute
		                     WHERE attrelid = c.oid AND attname = 'user_id')])
		FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'finance\_%'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var found []string
	for rows.Next() {
		var name string
		var cascades bool
		if err := rows.Scan(&name, &cascades); err != nil {
			t.Fatal(err)
		}
		found = append(found, name)
		if !cascades {
			t.Errorf("%s: user_id must reference users ON DELETE CASCADE", name)
		}
	}
	listed := slices.Clone(finance.FinanceTables)
	slices.Sort(found)
	slices.Sort(listed)
	if !slices.Equal(found, listed) {
		t.Errorf("finance tables in the schema = %v, financeTables = %v", found, listed)
	}
}
