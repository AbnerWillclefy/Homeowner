package finance_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// leftoverNow reads this month's leftover from the commitments outlook.
func leftoverNow(t *testing.T, c *apitest.Client) float64 {
	t.Helper()
	_, months := commitmentsRaw(t, c)
	return months[0]["leftoverCents"].(float64)
}

// setLeftover sets the income so this month's leftover is exactly want.
func setLeftover(t *testing.T, c *apitest.Client, want int64) {
	t.Helper()
	apitest.ExpectStatus(t, putIncome(c, 5_000_000), http.StatusNoContent)
	income := 5_000_000 + want - int64(leftoverNow(t, c))
	apitest.ExpectStatus(t, putIncome(c, income), http.StatusNoContent)
	if got := leftoverNow(t, c); got != float64(want) {
		t.Fatalf("leftover = %v, want %d", got, want)
	}
}

func newDatedGoal(t *testing.T, c *apitest.Client, name string, cents int64, month any) {
	t.Helper()
	res := c.Post("/me/finance/goals", map[string]any{"name": name, "targetCents": cents, "targetMonth": month})
	apitest.ExpectStatus(t, res, http.StatusCreated)
}

func savingsBody(t *testing.T, c *apitest.Client) map[string]any {
	t.Helper()
	res := c.Get("/me/finance/savings")
	apitest.ExpectStatus(t, res, http.StatusOK)
	return res.Body
}

func asMap(t *testing.T, v any) map[string]any {
	t.Helper()
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("%v is not an object", v)
	}
	return m
}

func wantFields(t *testing.T, what string, got, want map[string]any) {
	t.Helper()
	for k, w := range want {
		if g, ok := got[k]; !ok || g != w {
			t.Errorf("%s.%s = %v (present %v), want %v", what, k, g, ok, w)
		}
	}
}

func wantAbsent(t *testing.T, why string, b map[string]any, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if v, ok := b[k]; ok {
			t.Errorf("%s = %v %s, want absent", k, v, why)
		}
	}
}

func goalsOf(t *testing.T, body map[string]any) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, g := range body["goals"].([]any) {
		out = append(out, asMap(t, g))
	}
	return out
}

// suggestionSetup is the worked example (fake clock 2026-11-08):
//
//	Reserve target 600000; Investments: 200000 for the reserve, 150000 for Goals.
//	Base 100000, reserve share 40%. Goals in order: Viagem 100000 (no date),
//	Carro 300000 (2027-01), Reforma 50000 (no date).
//
// The reserve saved 200000 misses 400000 and takes 40000 a month: full after 10
// months (2027-08). The Goals pot of 150000 goes to Carro (dated first). Of the
// 60000 left for Goals this month, Carro needs ceil(150000 / 3 months left) = 50000
// and Viagem gets the other 10000. Carro is full in 2027-01 (on time). Viagem gets
// 10000 in each of the 3 months, then 60000 in 2027-02 and 10000 in 2027-03 (full);
// Reforma gets the other 50000 in 2027-03. Nothing is left with no Goal.
func suggestionSetup(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app, ana := seedMonth(t)
	apitest.ExpectStatus(t, putReserve(ana, 600000), http.StatusNoContent)
	newInvestment(t, ana, "CDB", 200000, "reserve")
	newInvestment(t, ana, "Tesouro", 150000, "goals")
	newDatedGoal(t, ana, "Viagem", 100000, nil)
	newDatedGoal(t, ana, "Carro", 300000, "2027-01")
	newDatedGoal(t, ana, "Reforma", 50000, nil)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 40), http.StatusNoContent)
	return app, ana
}

func TestSavingsSuggestionEndToEnd(t *testing.T) {
	t.Parallel()
	app, ana := suggestionSetup(t)
	insertTxn(t, app, "g1", "2026-11-03", -30000, "groceries") // a card charge
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 100000}), http.StatusNoContent)
	newBill(t, ana, "Aluguel", 50000, 10)
	setLeftover(t, ana, 250000) // 150000 above the base

	b := savingsBody(t, ana)
	wantFields(t, "reserve", asMap(t, b["reserve"]), map[string]any{
		"targetCents": float64(600000), "savedCents": float64(200000), "monthCents": float64(40000), "expectedMonth": "2027-08"})
	goals := goalsOf(t, b)
	for i, want := range []map[string]any{
		{"name": "Viagem", "savedCents": float64(0), "monthCents": float64(10000), "expectedMonth": "2027-03", "late": false},
		{"name": "Carro", "savedCents": float64(150000), "monthCents": float64(50000), "expectedMonth": "2027-01", "late": false},
		{"name": "Reforma", "savedCents": float64(0), "monthCents": float64(0), "expectedMonth": "2027-03", "late": false},
	} {
		wantFields(t, want["name"].(string), goals[i], want)
	}
	if b["unassignedCents"] != float64(0) {
		t.Errorf("unassignedCents = %v, want 0", b["unassignedCents"])
	}
	// 250000 a month, 40% = 100000 to the reserve: full in 4 months (offset 3), 6 sooner than offset 9.
	wantFields(t, "leftover", asMap(t, b["leftover"]), map[string]any{
		"leftoverCents": float64(250000), "extraCents": float64(150000), "monthsSooner": float64(6)})
	wantAbsent(t, "above the base", b, "overLimit")
	if got := leftoverNow(t, ana); asMap(t, b["leftover"])["leftoverCents"] != got {
		t.Errorf("savings leftover differs from commitments %v", got)
	}
}

func TestSavingsLateGoalAndMoneyWithNoGoal(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putContribution(ana, 10000, 0), http.StatusNoContent)
	newInvestment(t, ana, "Tesouro", 90000, "goals")
	newDatedGoal(t, ana, "Moto", 200000, "2026-12") // 110000 missing at 10000 a month: 11 months, due in 2
	newDatedGoal(t, ana, "Livro", 20000, nil)       // the pot goes to Moto first
	g := goalsOf(t, savingsBody(t, ana))
	wantFields(t, "Moto", g[0], map[string]any{"savedCents": float64(90000), "monthCents": float64(10000), "expectedMonth": "2027-09", "late": true})
	wantFields(t, "Livro", g[1], map[string]any{"savedCents": float64(0), "late": false})

	// A pot bigger than every Goal leaves the surplus with no Goal to take it.
	newInvestment(t, ana, "Fundo", 400000, "goals")
	if got := savingsBody(t, ana)["unassignedCents"]; got != float64(270000+10000) {
		t.Errorf("unassignedCents = %v, want pot 490000 - 220000 = 270000 plus this month's base 10000", got)
	}
}

func TestSavingsLeftoverBelowEqualAndAbove(t *testing.T) {
	t.Parallel()
	app, ana := suggestionSetup(t)
	insertTxn(t, app, "g1", "2026-11-03", -30000, "groceries")
	insertTxn(t, app, "t1", "2026-11-04", -9000, "transport")
	_, cats, _ := readMonth(t, ana, "2026-11")
	groceries, transport := cats["groceries"], cats["transport"]
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": groceries - 7000}), http.StatusNoContent)
	apitest.ExpectStatus(t, putLimit(ana, "transport", map[string]int64{"limitCents": transport + 1}), http.StatusNoContent)

	setLeftover(t, ana, 99999) // one under the base: groceries is over, transport is not
	b := savingsBody(t, ana)
	wantAbsent(t, "below the base", b, "leftover")
	over, _ := b["overLimit"].([]any)
	if len(over) != 1 || asMap(t, over[0])["category"] != "groceries" || asMap(t, over[0])["overCents"] != float64(7000) {
		t.Errorf("overLimit = %v, want only groceries 7000", b["overLimit"])
	}

	setLeftover(t, ana, -5000) // negative is below the base too
	if over, _ := savingsBody(t, ana)["overLimit"].([]any); len(over) != 1 {
		t.Errorf("negative leftover: overLimit = %v, want groceries", over)
	}

	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": groceries}), http.StatusNoContent)
	setLeftover(t, ana, 99999)
	b = savingsBody(t, ana)
	if over, ok := b["overLimit"].([]any); !ok || len(over) != 0 {
		t.Errorf("overLimit = %v, want [] when nothing is over", b["overLimit"])
	}

	setLeftover(t, ana, 100000)
	wantAbsent(t, "at the base", savingsBody(t, ana), "leftover", "overLimit")
}

func TestSavingsWithoutIncomeHasNeitherLeftoverNorOverLimit(t *testing.T) {
	t.Parallel()
	app, ana := suggestionSetup(t)
	insertTxn(t, app, "g1", "2026-11-03", -30000, "groceries")
	apitest.ExpectStatus(t, putLimit(ana, "groceries", map[string]int64{"limitCents": 1000}), http.StatusNoContent)
	wantAbsent(t, "with no income", savingsBody(t, ana), "leftover", "overLimit")
}

func TestSavingsWithoutContributionKeepsSavedAmounts(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	setLeftover(t, ana, 50000)
	apitest.ExpectStatus(t, putReserve(ana, 600000), http.StatusNoContent)
	newInvestment(t, ana, "CDB", 200000, "reserve")
	newInvestment(t, ana, "Tesouro", 30000, "goals")
	newDatedGoal(t, ana, "Carro", 300000, "2027-01")
	b := savingsBody(t, ana)
	wantFields(t, "reserve", asMap(t, b["reserve"]), map[string]any{"savedCents": float64(200000), "monthCents": nil, "expectedMonth": nil})
	wantFields(t, "Carro", goalsOf(t, b)[0], map[string]any{"savedCents": float64(30000), "monthCents": nil, "expectedMonth": nil, "late": false})
	wantAbsent(t, "with no contribution", b, "leftover", "overLimit")
}

func TestSavingsWithoutReserveTargetOrGoals(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	apitest.ExpectStatus(t, putContribution(ana, 100000, 40), http.StatusNoContent)
	newInvestment(t, ana, "CDB", 70000, "reserve")
	b := savingsBody(t, ana)
	wantFields(t, "reserve", asMap(t, b["reserve"]), map[string]any{"targetCents": nil, "savedCents": float64(70000), "monthCents": float64(0), "expectedMonth": nil})
	if g := goalsOf(t, b); len(g) != 0 {
		t.Errorf("goals = %v, want none", g)
	}
	if b["unassignedCents"] != float64(100000) {
		t.Errorf("unassignedCents = %v, want the whole base 100000: no target means the reserve takes nothing, and no Goal takes it", b["unassignedCents"])
	}
}
