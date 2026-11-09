package finance_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

// Fixture facts: the capture is 50 rows, newest 2026-11-07, summing to 4277284 centavos.
const (
	fixtureRows  = 50
	fixtureCents = 4277284
)

var afterFixtures = time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)

// startSync starts the API with Pluggy faked, the clock just after the fixtures,
// and every email connected to the sandbox Item with working credentials.
func startSync(t *testing.T, emails []string, opts ...apitest.Option) (*apitest.App, map[string]*apitest.Client) {
	t.Helper()
	opts = append([]apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), emails...), apitest.WithPluggy()}, opts...)
	app := apitest.Start(t, opts...)
	app.Clock.Set(afterFixtures)
	users := map[string]*apitest.Client{}
	for _, e := range emails {
		c := app.SignInAs(e)
		creds := map[string]string{"clientId": pluggytest.ClientID, "clientSecret": pluggytest.ClientSecret}
		if res := c.Put("/me/finance/credentials", creds); res.Status != http.StatusNoContent {
			t.Fatalf("PUT credentials = %d %s", res.Status, res.Raw)
		}
		if res := c.Post("/me/finance/items", map[string]string{"itemId": pluggytest.ItemID}); res.Status != http.StatusOK {
			t.Fatalf("POST items = %d %s", res.Status, res.Raw)
		}
		users[e] = c
	}
	return app, users
}

func scalar(t *testing.T, app *apitest.App, query string, args ...any) (n int64) {
	t.Helper()
	if err := app.DB.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

func TestFullImportStoresEveryTransactionExactly(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]

	if st := ana.Get("/me/finance"); st.Body["importing"] != true || st.Body["lastSyncedAt"] != nil {
		t.Fatalf("before sync: %s, want importing and no lastSyncedAt", st.Raw)
	}
	sum := app.RunFinanceSync(t)
	if sum.Due != 1 || sum.Synced != 1 || sum.Failed != 0 {
		t.Errorf("summary = %+v, want one User due and synced", sum)
	}

	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d, want %d", n, fixtureRows)
	}
	if n := scalar(t, app, `SELECT sum(amount_cents) FROM finance_transactions`); n != fixtureCents {
		t.Errorf("sum of amount_cents = %d, want %d", n, fixtureCents)
	}
	// A card purchase is negative with type CREDIT in Pluggy: the sign decides.
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'NETFLIX.COM' AND amount_cents = -5590 AND type = 'expense'
		AND spending_category = 'subscriptions' AND category_set_by = 'auto' AND type_set_by = 'auto' AND posted_on = '2026-11-01'`); n != 1 {
		t.Errorf("latest NETFLIX.COM rows = %d, want 1 expense of -5590 on 2026-11-01", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'SALARIO EMPRESA XYZ LTDA' AND amount_cents = 850000
		AND type = 'income' AND spending_category IS NULL AND merchant_key = 'SALARIO EMPRESA XYZ LTDA'`); n != 6 {
		t.Errorf("salary rows = %d, want 6 incomes of 850000", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE installment_number = 2 AND total_installments = 6`); n != 1 {
		t.Errorf("installment rows = %d, want 1", n)
	}

	st := ana.Get("/me/finance")
	if st.Body["importing"] != false || st.Body["lastSyncedAt"] != afterFixtures.Format(time.RFC3339) {
		t.Errorf("after sync: %s, want finished with lastSyncedAt %s", st.Raw, afterFixtures.Format(time.RFC3339))
	}
}

func TestResumedImportContinuesFromTheCursor(t *testing.T) {
	t.Parallel()
	// A budget this small ends every run after its first window.
	app, users := startSync(t, []string{"ana@example.com"}, apitest.WithFinanceSyncBudget(time.Nanosecond))
	ana := users["ana@example.com"]
	cursor := func() string {
		var c *time.Time
		if err := app.DB.QueryRow(context.Background(), `SELECT min(import_cursor) FROM finance_sources`).Scan(&c); err != nil || c == nil {
			t.Fatalf("read cursor: %v %v", c, err)
		}
		return c.Format(time.DateOnly)
	}

	if sum := app.RunFinanceSync(t); sum.Partial != 1 || sum.Synced != 0 {
		t.Errorf("first run = %+v, want one partial", sum)
	}
	// 12 months back from 2026-11-08 starts on 2025-11-08; one window is a month.
	if got := cursor(); got != "2025-12-07" {
		t.Errorf("cursor after run 1 = %s, want 2025-12-07", got)
	}
	if st := ana.Get("/me/finance"); st.Body["importing"] != true {
		t.Errorf("after run 1: %s, want still importing", st.Raw)
	}
	app.RunFinanceSync(t)
	if got := cursor(); got != "2026-01-07" {
		t.Errorf("cursor after run 2 = %s, want 2026-01-07 (resumed, not restarted)", got)
	}

	for i := 0; i < 20; i++ {
		app.RunFinanceSync(t)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d, want %d without duplicates", n, fixtureRows)
	}
	if st := ana.Get("/me/finance"); st.Body["importing"] != false || st.Body["lastSyncedAt"] == nil {
		t.Errorf("after the last run: %s, want finished", st.Raw)
	}
}

func TestRepeatedSyncDuplicatesNothing(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)

	if sum := app.RunFinanceSync(t); sum.Due != 0 {
		t.Errorf("a minute later: %+v, want nobody due", sum)
	}
	app.Clock.Advance(25 * time.Hour)
	if sum := app.RunFinanceSync(t); sum.Due != 1 || sum.Synced != 1 {
		t.Errorf("a day later: %+v, want the User synced again", sum)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d, want %d", n, fixtureRows)
	}
}

func TestSyncKeepsWhatTheUserSet(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(context.Background(), `
		UPDATE finance_transactions SET type = 'transfer', type_set_by = 'user', spending_category = NULL, category_set_by = NULL
		WHERE description = 'NETFLIX.COM';
		UPDATE finance_transactions SET spending_category = 'leisure', category_set_by = 'user' WHERE description = 'SPOTIFY AB'`); err != nil {
		t.Fatal(err)
	}

	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'NETFLIX.COM' AND type = 'transfer' AND type_set_by = 'user' AND spending_category IS NULL`); n != 6 {
		t.Errorf("user-typed rows = %d, want 6 untouched", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'SPOTIFY AB' AND spending_category = 'leisure' AND category_set_by = 'user'`); n != 6 {
		t.Errorf("user-categorised rows = %d, want 6 untouched", n)
	}
}

// A card refund is an expense by Source kind; a category the User set on it must
// survive the next sync without breaking the type/category CHECK.
func TestSyncKeepsAUserCategoryOnACardRefund(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	ctx := context.Background()
	if _, err := app.DB.Exec(ctx, `UPDATE finance_sources SET kind = 'credit_card'`); err != nil {
		t.Fatal(err)
	}
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(ctx, `UPDATE finance_transactions SET spending_category = 'leisure', category_set_by = 'user' WHERE amount_cents > 0 AND type = 'expense'`); err != nil {
		t.Fatal(err)
	}
	n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE category_set_by = 'user'`)
	if n == 0 {
		t.Fatal("no card refund to categorise")
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if got := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE amount_cents > 0 AND type = 'expense' AND spending_category = 'leisure' AND category_set_by = 'user'`); got != n {
		t.Errorf("categorised refunds = %d, want %d kept", got, n)
	}
}

// The sandbox has only the checking side of the card bill payment (the card has
// no matching credit), so the PAGAMENTO FATURA rows are what the sync must type
// as transfers; pairing across Sources is covered by TestClassify.
func TestSyncClassifiesBillPaymentsAsTransfers(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	q := `SELECT count(*) FROM finance_transactions WHERE description LIKE 'PAGAMENTO FATURA%' AND type = 'transfer' AND type_set_by = 'auto' AND spending_category IS NULL`
	n := scalar(t, app, q)
	if n == 0 || n != scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description LIKE 'PAGAMENTO FATURA%'`) {
		t.Fatalf("auto transfers = %d, want every bill payment", n)
	}
	// A repeat sync re-reads the rows and must keep them transfers.
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if got := scalar(t, app, q); got != n {
		t.Fatalf("auto transfers after a repeat sync = %d, want %d", got, n)
	}
	// A row the User typed stays, and a repeat sync keeps the result.
	if _, err := app.DB.Exec(context.Background(), `
		UPDATE finance_transactions SET type = 'expense', type_set_by = 'user', spending_category = 'other', category_set_by = 'user'
		WHERE description LIKE 'PAGAMENTO FATURA%'`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if got := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description LIKE 'PAGAMENTO FATURA%' AND type = 'expense' AND type_set_by = 'user'`); got != n {
		t.Errorf("user-typed bill payments = %d, want %d untouched", got, n)
	}
}

// The synthetic checking page holds 2026-01-14 and 01-15, so classify reads
// 01-08..01-21 and writes only 01-11..01-18. A pair across the write edge must
// see its partner, and a pair across the read edge must not be written half-seen.
func TestSyncKeepsTransfersWholeAtTheWindowEdges(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, created_at, updated_at)
		SELECT s.user_id, s.id, 'edge-' || p.day, p.day, p.cents, 'BRL', 'EDGE', 'edge', 'transfer', 'auto', now(), now()
		FROM (VALUES ('checking', DATE '2026-01-12', -12345), ('credit_card', DATE '2026-01-09', 12345),
		             ('checking', DATE '2026-01-09', -67890), ('credit_card', DATE '2026-01-06', 67890)) AS p (kind, day, cents)
		JOIN finance_sources s ON s.kind = p.kind`); err != nil {
		t.Fatal(err)
	}

	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE description = 'EDGE' AND type = 'transfer'`); n != 4 {
		t.Errorf("edge transfers = %d, want 4 kept whole", n)
	}
}

func TestFailingPluggyLeavesTheUserDueAndOthersSynced(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	// Bob's credentials stop working at Pluggy.
	bad := map[string]string{"clientId": pluggytest.ClientID, "clientSecret": "wrong"}
	if res := users["bob@example.com"].Put("/me/finance/credentials", bad); res.Status != http.StatusNoContent {
		t.Fatal(res.Status)
	}

	sum := app.RunFinanceSync(t)
	if sum.Due != 2 || sum.Synced != 1 || sum.Failed != 1 {
		t.Errorf("summary = %+v, want ana synced and bob failed", sum)
	}
	if st := users["ana@example.com"].Get("/me/finance"); st.Body["lastSyncedAt"] == nil {
		t.Errorf("ana: %s, want synced", st.Raw)
	}
	if st := users["bob@example.com"].Get("/me/finance"); st.Body["lastSyncedAt"] != nil || st.Body["importing"] != true {
		t.Errorf("bob: %s, want unchanged and still importing", st.Raw)
	}

	app.Pluggy.Fail("/v2/transactions", http.StatusInternalServerError)
	app.Clock.Advance(25 * time.Hour)
	before := users["ana@example.com"].Get("/me/finance").Body["lastSyncedAt"]
	if sum := app.RunFinanceSync(t); sum.Failed != 2 || sum.Synced != 0 {
		t.Errorf("with transactions failing: %+v, want both failed", sum)
	}
	if after := users["ana@example.com"].Get("/me/finance").Body["lastSyncedAt"]; after != before {
		t.Errorf("ana lastSyncedAt = %v after a failed sync, want %v", after, before)
	}
}

func TestSyncSkipsAUserTakenOffTheList(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	if _, err := app.DB.Exec(context.Background(), `UPDATE users SET email = 'ana@elsewhere.com'`); err != nil {
		t.Fatal(err)
	}
	if sum := app.RunFinanceSync(t); sum.Due != 0 {
		t.Errorf("summary = %+v, want nobody due", sum)
	}
}

func TestSyncLogsNoSensitiveData(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	// A failing run too: the error paths must be clean as well.
	app.Pluggy.Fail("/v2/transactions", http.StatusInternalServerError)
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	logs := app.Logs.String()
	if !strings.Contains(logs, "finance sync") {
		t.Fatalf("no sync log line in %s", logs)
	}
	secrets := []string{"123.45", "12345", pluggytest.ClientID, pluggytest.ClientSecret, pluggytest.APIKey, pluggytest.FailBody}
	rows, err := app.DB.Query(context.Background(), `SELECT DISTINCT description FROM finance_transactions UNION SELECT provider_id FROM finance_transactions`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		secrets = append(secrets, s)
	}
	for _, s := range secrets {
		if strings.Contains(logs, s) {
			t.Errorf("logs contain %q", s)
		}
	}
}

func TestEventsHandlerRunsOnlyOnAScheduledEvent(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{"ana@example.com"})
	srv := httptest.NewServer(finance.EventsHandler(app.FinanceSyncer, nil, app.Clock, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(srv.Close)
	post := func(body string) int {
		res, err := http.Post(srv.URL+"/events", "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}

	for _, body := range []string{`{}`, `not json`, `{"source":"homeowner.dev","detail-type":"Replan Home"}`} {
		if got := post(body); got != http.StatusBadRequest {
			t.Errorf("POST %s = %d, want 400", body, got)
		}
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != 0 {
		t.Errorf("rows = %d after refused events, want 0", n)
	}
	if got := post(`{"source":"aws.events","detail-type":"Scheduled Event"}`); got != http.StatusOK {
		t.Errorf("scheduled event = %d, want 200", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("rows = %d after the scheduled event, want %d", n, fixtureRows)
	}
	res, err := http.Get(srv.URL + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		t.Errorf("GET /healthz = %v %v, want 200", res, err)
	}
}
