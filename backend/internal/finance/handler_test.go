package finance_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAllowedUserSeesFinanceStatusAndFlag(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	res := ana.Get("/me/finance")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /me/finance = %d %s", res.Status, res.Raw)
	}
	if got, ok := res.Body["configured"]; !ok || got != false || res.Body["importing"] != false {
		t.Errorf("body = %s, want configured false and not importing", res.Raw)
	}
	if me := ana.Get("/me"); me.Body["finance"] != true {
		t.Errorf("GET /me finance = %v, want true", me.Body["finance"])
	}
	if res := ana.Get("/me/finance/anything"); res.Status != http.StatusNotFound {
		t.Errorf("allowed user, unknown subpath = %d, want 404", res.Status)
	}
}

func TestUserNotOnTheListIsRefused(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	bob := app.SignInAs("bob@example.com")

	for _, p := range []string{"/me/finance", "/me/finance/", "/me/finance/anything", "/me/finance/history"} {
		if res := bob.Get(p); res.Status != http.StatusForbidden || res.Body["error"] != "forbidden" {
			t.Errorf("GET %s = %d %s, want 403 forbidden", p, res.Status, res.Raw)
		}
	}
	if me := bob.Get("/me"); me.Body["finance"] != false {
		t.Errorf("GET /me finance = %v, want false", me.Body["finance"])
	}
}

func TestEmptyOrAbsentListRefusesEveryone(t *testing.T) {
	t.Parallel()
	for name, opts := range map[string][]apitest.Option{
		"absent": nil,
		"empty":  {apitest.WithFinance(apitest.FinanceTestKey())},
	} {
		app := apitest.Start(t, opts...)
		c := app.SignInAs("ana@example.com")
		if res := c.Get("/me/finance"); res.Status != http.StatusForbidden {
			t.Errorf("%s list: GET /me/finance = %d, want 403", name, res.Status)
		}
		if me := c.Get("/me"); me.Body["finance"] != false {
			t.Errorf("%s list: finance = %v, want false", name, me.Body["finance"])
		}
	}
}

func TestEmailMatchingIgnoresCase(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "Ana@Example.com"))
	ana := app.SignInAs("ana@example.COM")

	if res := ana.Get("/me/finance"); res.Status != http.StatusOK {
		t.Errorf("GET /me/finance = %d %s, want 200", res.Status, res.Raw)
	}
}

func TestRenameKeepsFinanceFlag(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	res := ana.Put("/me/name", map[string]any{"name": "Ana"})
	if res.Status != http.StatusOK || res.Body["finance"] != true {
		t.Errorf("PUT /me/name = %d %s, want 200 with finance true", res.Status, res.Raw)
	}
}

func TestNoTokenIs401NotForbidden(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	if res := app.Get("/me/finance"); res.Status != http.StatusUnauthorized {
		t.Errorf("GET /me/finance without token = %d, want 401", res.Status)
	}
}

// seedMonth runs the sandbox sync for Ana and Bob; the newest month is 2026-11.
func seedMonth(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	app.RunFinanceSync(t)
	return app, users["ana@example.com"]
}

type txnBody struct {
	ID, SourceName, Type, Description, TypeSetBy string
	AmountCents                                  int64
	SpendingCategory, CategorySetBy              *string
}

type catBody struct {
	Category   string
	SpentCents int64
}

func readMonth(t *testing.T, c *apitest.Client, month string) (spent int64, cats map[string]int64, txns []txnBody) {
	t.Helper()
	res := c.Get("/me/finance/transactions?month=" + month)
	if res.Status != http.StatusOK {
		t.Fatalf("GET month %s = %d %s", month, res.Status, res.Raw)
	}
	var body struct {
		SpentCents   int64
		Categories   []catBody
		Transactions []txnBody
	}
	if err := json.Unmarshal(res.Raw, &body); err != nil {
		t.Fatal(err)
	}
	cats = map[string]int64{}
	for i, c := range body.Categories {
		cats[c.Category] = c.SpentCents
		if i > 0 && body.Categories[i-1].SpentCents < c.SpentCents {
			t.Errorf("categories not sorted largest first: %s", res.Raw)
		}
	}
	return body.SpentCents, cats, body.Transactions
}

func patch(c *apitest.Client, id string, body any) apitest.Response {
	return c.Do(http.MethodPatch, "/me/finance/transactions/"+id, body, nil)
}

// find returns the first Transaction of month with that description.
func find(t *testing.T, c *apitest.Client, month, description string) txnBody {
	t.Helper()
	_, _, txns := readMonth(t, c, month)
	for _, x := range txns {
		if x.Description == description {
			return x
		}
	}
	t.Fatalf("no %q in %s", description, month)
	return txnBody{}
}

func TestChangingToTransferTakesTheRowOutOfTheTotals(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	res := patch(ana, boleto.ID, map[string]string{"type": "transfer"})
	if res.Status != http.StatusOK || res.Body["type"] != "transfer" || res.Body["typeSetBy"] != "user" || res.Body["spendingCategory"] != nil || res.Body["categorySetBy"] != nil {
		t.Fatalf("PATCH = %d %s, want the row as a user transfer without category", res.Status, res.Raw)
	}
	if spent, cats, _ := readMonth(t, ana, "2026-11"); spent != 87780 || cats["other"] != 0 {
		t.Errorf("spent %d cats %v, want 87780 without the transfer", spent, cats)
	}
}

func TestChangingToExpenseDefaultsToOtherAndKeepsAGivenCategory(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	lab := find(t, ana, "2026-11", "lab")
	interest := find(t, ana, "2026-11", "Intereses Compensatorios")

	res := patch(ana, lab.ID, map[string]string{"type": "expense"})
	if res.Status != http.StatusOK || res.Body["type"] != "expense" || res.Body["spendingCategory"] != "other" || res.Body["categorySetBy"] != "fallback" {
		t.Errorf("PATCH expense = %d %s, want other/fallback", res.Status, res.Raw)
	}
	res = patch(ana, interest.ID, map[string]string{"type": "expense", "spendingCategory": "taxes_fees"})
	if res.Status != http.StatusOK || res.Body["spendingCategory"] != "taxes_fees" || res.Body["categorySetBy"] != "user" {
		t.Errorf("PATCH expense with category = %d %s, want taxes_fees/user", res.Status, res.Raw)
	}
}

func TestChangingTheCategoryKeepsTheTypeAuto(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	res := patch(ana, boleto.ID, map[string]string{"spendingCategory": "leisure"})
	if res.Status != http.StatusOK || res.Body["spendingCategory"] != "leisure" || res.Body["categorySetBy"] != "user" || res.Body["typeSetBy"] != "auto" {
		t.Fatalf("PATCH = %d %s, want leisure set by user and the type still auto", res.Status, res.Raw)
	}
	if _, cats, _ := readMonth(t, ana, "2026-11"); cats["leisure"] != 10000 || cats["other"] != 0 {
		t.Errorf("cats %v, want leisure 10000", cats)
	}
}

func TestConfirmingAnExpenseKeepsItsCategory(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	res := patch(ana, boleto.ID, map[string]string{"type": "expense"})
	if res.Status != http.StatusOK || res.Body["typeSetBy"] != "user" || res.Body["spendingCategory"] != *boleto.SpendingCategory || res.Body["categorySetBy"] != *boleto.CategorySetBy {
		t.Errorf("PATCH type only = %d %s, want the category kept", res.Status, res.Raw)
	}
}

func TestPatchRejectsBadInput(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	salary := find(t, ana, "2026-11", "SALARIO EMPRESA XYZ LTDA")

	for name, body := range map[string]any{
		"empty":            map[string]string{},
		"unknown type":     map[string]string{"type": "gift"},
		"unknown category": map[string]string{"spendingCategory": "yachts"},
		"unknown field":    map[string]string{"description": "x"},
	} {
		if res := patch(ana, boleto.ID, body); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, res.Status, res.Raw)
		}
	}
	for name, c := range map[string]struct {
		id   string
		body map[string]string
	}{
		"transfer with category": {boleto.ID, map[string]string{"type": "transfer", "spendingCategory": "other"}},
		"category on an income":  {salary.ID, map[string]string{"spendingCategory": "other"}},
		"income with a category": {boleto.ID, map[string]string{"type": "income", "spendingCategory": "other"}},
	} {
		if res := patch(ana, c.id, c.body); res.Status != http.StatusBadRequest || res.Body["error"] != "category needs expense" {
			t.Errorf("%s = %d %s, want 400 category needs expense", name, res.Status, res.Raw)
		}
	}
	if got := find(t, ana, "2026-11", "Pagamento de boleto"); got.Type != "expense" || got.TypeSetBy != "auto" {
		t.Errorf("rejected edits changed the row: %+v", got)
	}
}

func TestPatchOfAnotherUsersOrUnknownRowIs404(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	bob := app.SignInAs("bob@example.com")
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	for name, id := range map[string]string{
		"another User's": boleto.ID,
		"unknown":        "00000000-0000-4000-8000-000000000000",
		"malformed":      "nope",
	} {
		if res := patch(bob, id, map[string]string{"type": "transfer"}); res.Status != http.StatusNotFound {
			t.Errorf("%s id = %d %s, want 404", name, res.Status, res.Raw)
		}
	}
	if got := find(t, ana, "2026-11", "Pagamento de boleto"); got.Type != "expense" {
		t.Errorf("Bob's attempt changed Ana's row: %+v", got)
	}
}

func TestAnEditSurvivesAReSync(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	salary := find(t, ana, "2026-11", "SALARIO EMPRESA XYZ LTDA")
	patch(ana, boleto.ID, map[string]string{"type": "transfer"})
	patch(ana, salary.ID, map[string]string{"type": "expense", "spendingCategory": "pets"})

	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	if got := find(t, ana, "2026-11", "Pagamento de boleto"); got.Type != "transfer" || got.TypeSetBy != "user" || got.SpendingCategory != nil {
		t.Errorf("boleto after the sync = %+v, want the user's transfer", got)
	}
	if got := find(t, ana, "2026-11", "SALARIO EMPRESA XYZ LTDA"); got.Type != "expense" || *got.SpendingCategory != "pets" || *got.CategorySetBy != "user" {
		t.Errorf("salary after the sync = %+v, want the user's pets expense", got)
	}
}

func TestAMerchantCorrectionReachesOtherRowsAndLaterSyncs(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	netflix := func(month string) txnBody { return find(t, ana, month, "NETFLIX.COM") }
	// The User had already filed October's charge under shopping.
	if res := patch(ana, netflix("2026-10").ID, map[string]string{"spendingCategory": "shopping"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if got := netflix("2026-11"); *got.SpendingCategory != "shopping" || *got.CategorySetBy != "auto" {
		t.Fatalf("first correction left november at %+v, want shopping/auto", got)
	}

	// A second correction moves every unedited row, and leaves the user's own alone.
	if res := patch(ana, netflix("2026-11").ID, map[string]string{"spendingCategory": "leisure"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if got := netflix("2026-10"); *got.SpendingCategory != "shopping" || *got.CategorySetBy != "user" {
		t.Errorf("october's own edit = %+v, want shopping/user", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions t JOIN users u ON u.id = t.user_id
		WHERE u.email = 'ana@example.com' AND merchant_key = 'NETFLIX COM' AND spending_category = 'leisure'`); n != 5 {
		t.Errorf("rows of the merchant in leisure = %d, want 5 of 6", n)
	}
	// Bob's rows of the same merchant are untouched.
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions t JOIN users u ON u.id = t.user_id
		WHERE u.email = 'bob@example.com' AND merchant_key = 'NETFLIX COM' AND spending_category = 'leisure'`); n != 0 {
		t.Errorf("bob's rows in leisure = %d, want 0", n)
	}

	// A new row of the merchant, arriving in a later sync, takes the correction.
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_transactions WHERE description = 'NETFLIX.COM' AND posted_on = '2026-11-01'`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if got := netflix("2026-11"); *got.SpendingCategory != "leisure" || *got.CategorySetBy != "auto" {
		t.Errorf("new november row = %+v, want leisure/auto from the saved correction", got)
	}
}

func TestMonthListsTransactionsAndTotalsPerCategory(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)

	spent, cats, txns := readMonth(t, ana, "2026-11")
	if spent != 97780 || len(cats) != 3 || cats["housing"] != 80000 || cats["other"] != 10000 || cats["subscriptions"] != 7780 {
		t.Errorf("spent %d cats %v, want 97780 with housing 80000, other 10000, subscriptions 7780", spent, cats)
	}
	if len(txns) != 7 {
		t.Fatalf("transactions = %d, want 7", len(txns))
	}
	if f := txns[0]; f.Description != "Pagamento de boleto" || f.AmountCents != -10000 || f.SourceName == "" || f.Type != "expense" {
		t.Errorf("newest = %+v, want the boleto expense of -10000", f)
	}
	if res := ana.Get("/me/finance/transactions?month=2026-11"); !strings.Contains(string(res.Raw), `"currency":"BRL"`) || !strings.Contains(string(res.Raw), `"installment":null`) {
		t.Errorf("body lacks currency or installment: %s", res.Raw)
	}
}

func TestTransfersAreLeftOutAndRefundsOffset(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)

	if spent, cats, _ := readMonth(t, ana, "2026-10"); spent != 127270 || cats["household_bills"] != 30500 {
		t.Errorf("october spent %d cats %v, want 127270 and household_bills 30500 with the 16770 transfer left out", spent, cats)
	}
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, 'refund', DATE '2026-11-03', 3000, 'BRL', 'REFUND', 'REFUND', 'expense', 'auto', 'housing', 'user', now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`); err != nil {
		t.Fatal(err)
	}
	if spent, cats, _ := readMonth(t, ana, "2026-11"); spent != 94780 || cats["housing"] != 77000 {
		t.Errorf("november spent %d cats %v, want the refund to offset housing to 77000", spent, cats)
	}
}

func TestInvalidMonthIs400(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)

	for _, m := range []string{"", "2026-13", "2026-1", "nope", "1999-12", "2101-01"} {
		if res := ana.Get("/me/finance/transactions?month=" + m); res.Status != http.StatusBadRequest || res.Body["error"] != "invalid month" {
			t.Errorf("month %q = %d %s, want 400 invalid month", m, res.Status, res.Raw)
		}
	}
	if res := ana.Get("/me/finance/transactions"); res.Status != http.StatusBadRequest {
		t.Errorf("no month = %d, want 400", res.Status)
	}
}

func TestMonthNeverShowsAnotherUsersRows(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	bob := app.SignInAs("bob@example.com")

	// Both synced the same Item; with Bob's rows gone, Ana's must not fill in for him.
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM finance_transactions WHERE user_id = (SELECT id FROM users WHERE email = 'bob@example.com')`); err != nil {
		t.Fatal(err)
	}
	if spent, _, txns := readMonth(t, bob, "2026-11"); spent != 0 || len(txns) != 0 {
		t.Errorf("bob sees spent %d in %d rows, want nothing", spent, len(txns))
	}
	if _, _, txns := readMonth(t, ana, "2026-11"); len(txns) != 7 {
		t.Errorf("ana sees %d rows, want 7", len(txns))
	}
}
