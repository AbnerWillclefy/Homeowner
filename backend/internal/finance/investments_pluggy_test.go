package finance_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

// Fixture facts: the sandbox capture holds 8 Investments, the largest worth 11720.42.
const (
	fixtureInvestments = 8
	largestName        = "ITAU Sandbox previdencia"
	largestCents       = 1172042
)

func investmentNamed(t *testing.T, c *apitest.Client, name string) map[string]any {
	t.Helper()
	for _, i := range savedInvestments(t, c) {
		if i["name"] == name {
			return i
		}
	}
	t.Fatalf("no Investment named %q in %v", name, savedInvestments(t, c))
	return nil
}

func TestSyncStoresEachBankInvestmentOnce(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	if got := savedInvestments(t, ana); len(got) != fixtureInvestments {
		t.Fatalf("Investments after two syncs = %d, want %d", len(got), fixtureInvestments)
	}
	i := investmentNamed(t, ana, largestName)
	if i["source"] != "pluggy" || i["serves"] != nil || i["valueCents"] != float64(largestCents) || i["reportedByBank"] != true {
		t.Errorf("new bank Investment = %v, want pluggy, serves null, %d, reportedByBank true", i, largestCents)
	}
}

// Each reader (reserve saved, Goals pot, contribution split) is the same with the
// unpicked bank Investments as without them, and moves once one is picked.
func TestUnpickedBankInvestmentCountsTowardNothing(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	apitest.ExpectStatus(t, ana.Put("/me/finance/reserve", map[string]any{"targetCents": 5000000}), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put("/me/finance/contribution", map[string]any{"baseCents": 100000, "reserveSharePercent": 50}), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Post("/me/finance/goals", map[string]any{"name": "Trip", "targetCents": 2000000, "targetMonth": nil}), http.StatusCreated)
	read := func() (reserveSaved, goalSaved, reserveMonth, unassigned any) {
		body := ana.Get("/me/finance/savings").Body
		r := body["reserve"].(map[string]any)
		g := body["goals"].([]any)[0].(map[string]any)
		return r["savedCents"], g["savedCents"], r["monthCents"], body["unassignedCents"]
	}
	rs0, gs0, rm0, un0 := read()
	app.RunFinanceSync(t)
	if len(savedInvestments(t, ana)) != fixtureInvestments {
		t.Fatal("the sync stored no Investments")
	}
	rs, gs, rm, un := read()
	if rs != rs0 {
		t.Errorf("reserve saved = %v, want %v: an unpicked Investment counted toward the Emergency reserve", rs, rs0)
	}
	if gs != gs0 {
		t.Errorf("goal saved = %v, want %v: an unpicked Investment counted toward the Goals", gs, gs0)
	}
	if rm != rm0 || un != un0 {
		t.Errorf("split = (%v, %v), want (%v, %v): an unpicked Investment changed the contribution split", rm, un, rm0, un0)
	}

	id := investmentNamed(t, ana, largestName)["id"].(string)
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id+"/serves", map[string]any{"serves": "reserve"}), http.StatusNoContent)
	if rs, _, _, _ := read(); rs != float64(largestCents) {
		t.Errorf("reserve saved after picking = %v, want %d", rs, largestCents)
	}
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id+"/serves", map[string]any{"serves": "goals"}), http.StatusNoContent)
	if rs, gs, _, _ := read(); rs != rs0 || gs != float64(largestCents) {
		t.Errorf("after changing the pick: reserve %v goal %v, want %v and %d", rs, gs, rs0, largestCents)
	}
}

func TestSyncLeavesHandTypedInvestmentsAlone(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	newInvestment(t, ana, largestName, 777, "goals") // same name as a bank one: never merged
	app.RunFinanceSync(t)

	var hand []map[string]any
	for _, i := range savedInvestments(t, ana) {
		if i["source"] == "hand" {
			hand = append(hand, i)
		}
	}
	if len(hand) != 1 || hand[0]["valueCents"] != float64(777) || hand[0]["serves"] != "goals" {
		t.Errorf("hand-typed Investments = %v, want the one typed, unchanged", hand)
	}
	if _, has := hand[0]["reportedByBank"]; has {
		t.Errorf("a hand-typed Investment has reportedByBank: %v", hand[0])
	}
	if n := len(savedInvestments(t, ana)); n != fixtureInvestments+1 {
		t.Errorf("Investments = %d, want %d", n, fixtureInvestments+1)
	}
}

func TestInvestmentTheBankStopsReportingStays(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	// A row the bank reported once and no longer returns.
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_investments (id, user_id, name, value_cents, serves, created_at, updated_at, item_id, pluggy_investment_id, bank_value_cents, value_set_by, bank_reported)
		SELECT gen_random_uuid(), i.user_id, 'Gone CDB', 4200, 'reserve', now(), now(), i.id, 'gone', 4200, 'bank', true FROM finance_items i`); err != nil {
		t.Fatal(err)
	}
	app.RunFinanceSync(t)
	gone := investmentNamed(t, ana, "Gone CDB")
	if gone["valueCents"] != float64(4200) || gone["serves"] != "reserve" || gone["reportedByBank"] != false || gone["source"] != "pluggy" {
		t.Errorf("unreported Investment = %v, want kept with its value and reportedByBank false", gone)
	}
}

func TestFailedInvestmentsCallDoesNotFailTheImport(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.Pluggy.Fail("/investments", http.StatusInternalServerError)
	sum := app.RunFinanceSync(t)
	if sum.Synced != 1 || sum.Failed != 0 {
		t.Errorf("summary = %+v, want the Item synced", sum)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions`); n != fixtureRows {
		t.Errorf("transactions = %d, want %d", n, fixtureRows)
	}
	if len(savedInvestments(t, users["ana@example.com"])) != 0 {
		t.Error("Investments were stored from a failed call")
	}
	if !app.Logs.Contains("investments") || app.Logs.Contains(pluggytest.FailBody) {
		t.Error("the failure should be logged with step investments and never the body")
	}
}

func TestEachSyncWritesTheBankValueToHistory(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	id := investmentNamed(t, users["ana@example.com"], largestName)["id"].(string)
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	got := history(t, app, "ana@example.com", id)
	if len(got) != 2 || got[0].Value != largestCents || got[1].Value != largestCents || !got[1].Day.After(got[0].Day) {
		t.Errorf("history = %v, want one row per sync day at %d", got, largestCents)
	}
}

func TestPickingWhatABankInvestmentServes(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	ana, bia := users["ana@example.com"], users["bia@example.com"]
	app.RunFinanceSync(t)
	id := investmentNamed(t, ana, largestName)["id"].(string)
	path := "/me/finance/investments/" + id + "/serves"

	apitest.ExpectStatus(t, bia.Put(path, map[string]any{"serves": "reserve"}), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/nope/serves", map[string]any{"serves": "reserve"}), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Put(path, map[string]any{"serves": "nothing"}), http.StatusBadRequest)
	apitest.ExpectStatus(t, ana.Put(path, map[string]any{"serves": nil}), http.StatusBadRequest)
	if i := investmentNamed(t, ana, largestName); i["serves"] != nil {
		t.Errorf("a refused pick changed serves to %v", i["serves"])
	}
	apitest.ExpectStatus(t, ana.Put(path, map[string]any{"serves": "reserve"}), http.StatusNoContent)
	if i := investmentNamed(t, ana, largestName); i["serves"] != "reserve" || i["valueCents"] != float64(largestCents) {
		t.Errorf("after the pick = %v, want reserve and an unchanged value", i)
	}
}

func TestABankInvestmentCannotBeDeleted(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	id := investmentNamed(t, ana, largestName)["id"].(string)
	res := ana.Delete("/me/finance/investments/" + id)
	if res.Status != http.StatusConflict || res.Body["error"] != "bank investment" {
		t.Errorf("DELETE = %d %s, want 409 bank investment", res.Status, res.Raw)
	}
	if len(savedInvestments(t, ana)) != fixtureInvestments {
		t.Error("the bank Investment was deleted")
	}
}

func setSQL(t *testing.T, app *apitest.App, id, set string) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), "UPDATE finance_investments SET "+set+" WHERE id = $1", id); err != nil {
		t.Fatal(err)
	}
}

func TestEditedBankInvestmentWinsUntilTheBankValueIsTaken(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	ana := users["ana@example.com"]
	app.RunFinanceSync(t)
	i := investmentNamed(t, ana, largestName)
	id := i["id"].(string)
	if i["edited"] != false || i["bankValueCents"] != float64(largestCents) {
		t.Fatalf("never edited = %v, want edited false and the bank value", i)
	}

	// A rename alone does not mark it edited.
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("Renamed", largestCents, "goals")), http.StatusOK)
	if i := investmentNamed(t, ana, "Renamed"); i["edited"] != false || i["serves"] != "goals" {
		t.Errorf("after a rename = %v, want not edited", i)
	}

	app.Clock.Advance(25 * time.Hour)
	res := ana.Put("/me/finance/investments/"+id, investmentBody("Renamed", 5000, "goals"))
	apitest.ExpectStatus(t, res, http.StatusOK)
	if res.Body["edited"] != true || res.Body["valueCents"] != float64(5000) || res.Body["bankValueCents"] != float64(largestCents) {
		t.Errorf("PUT = %s, want edited at 5000 beside the bank value", res.Raw)
	}

	// The bank moves, the sync keeps the User's figure and shows the bank's.
	setSQL(t, app, id, "bank_value_cents = 1")
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if i := investmentNamed(t, ana, "Renamed"); i["valueCents"] != float64(5000) || i["edited"] != true || i["bankValueCents"] != float64(largestCents) {
		t.Errorf("after sync = %v, want 5000 edited, bank value %d", i, largestCents)
	}

	app.Clock.Advance(25 * time.Hour)
	res = ana.Post("/me/finance/investments/"+id+"/use-bank-value", nil)
	apitest.ExpectStatus(t, res, http.StatusOK)
	if res.Body["valueCents"] != float64(largestCents) || res.Body["edited"] != false {
		t.Errorf("use-bank-value = %s, want the bank value, not edited", res.Raw)
	}

	// The sync follows the bank again.
	setSQL(t, app, id, "value_cents = 1")
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if i := investmentNamed(t, ana, "Renamed"); i["valueCents"] != float64(largestCents) || i["edited"] != false {
		t.Errorf("after following sync = %v, want %d", i, largestCents)
	}

	got := history(t, app, "ana@example.com", id)
	var values []int64
	for _, p := range got {
		values = append(values, p.Value)
	}
	want := []int64{largestCents, 5000, 5000, largestCents, largestCents}
	if len(values) != len(want) {
		t.Fatalf("history = %v, want %v", values, want)
	}
	for n := range want {
		if values[n] != want[n] {
			t.Fatalf("history = %v, want %v", values, want)
		}
	}
}

func TestUseBankValueRefusals(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	ana, bia := users["ana@example.com"], users["bia@example.com"]
	app.RunFinanceSync(t)
	id := investmentNamed(t, ana, largestName)["id"].(string)
	hand := newInvestment(t, ana, "CDB", 1000, "reserve")

	apitest.ExpectStatus(t, bia.Post("/me/finance/investments/"+id+"/use-bank-value", nil), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Post("/me/finance/investments/nope/use-bank-value", nil), http.StatusNotFound)
	res := ana.Post("/me/finance/investments/"+hand+"/use-bank-value", nil)
	if res.Status != http.StatusConflict || res.Body["error"] != "not a bank investment" {
		t.Errorf("hand-typed = %d %s, want 409", res.Status, res.Raw)
	}
	i := investmentNamed(t, ana, "CDB")
	if _, has := i["bankValueCents"]; has || i["edited"] != false {
		t.Errorf("hand-typed = %v, want no bankValueCents and not edited", i)
	}
	apitest.ExpectStatus(t, app.SignInAs("bob@example.com").Post("/me/finance/investments/"+id+"/use-bank-value", nil), http.StatusForbidden)
}

func TestSyncLeavesOutInvestmentsNotInReais(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.Pluggy.AddUSDInvestment()
	app.RunFinanceSync(t)
	if got := savedInvestments(t, users["ana@example.com"]); len(got) != 0 {
		t.Errorf("Investments = %v, want the USD one left out", got)
	}
	if !app.Logs.Contains("skipped_currency") {
		t.Error("the skip should be logged")
	}
}
