package finchat_test

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finchat"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func use(name, input string) llmalloc.ToolUse {
	return llmalloc.ToolUse{Name: name, Input: json.RawMessage(input)}
}

func exec(t *testing.T, app *apitest.App, query string, args ...any) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func created(t *testing.T, res apitest.Response) string {
	t.Helper()
	if res.Status != http.StatusCreated && res.Status != http.StatusOK {
		t.Fatalf("create = %d %s", res.Status, res.Raw)
	}
	return fmt.Sprint(res.Body["id"])
}

// seedFinances gives Ana a Monthly income, a paid and an unpaid Bill, a Goal, an
// Investment, a Monthly contribution, the Emergency reserve, a Manual card
// "Cartão da Ana" paid to the Pix recipient "Ana Souza", an Installment plan and
// closed bills on her bank card.
func seedFinances(t *testing.T, app *apitest.App, ana *apitest.Client) {
	t.Helper()
	apitest.ExpectStatus(t, ana.Put("/me/finance/income", map[string]any{"monthlyIncomeCents": 1000000}), http.StatusNoContent)
	rent := created(t, ana.Post("/me/finance/bills", map[string]any{"name": "Aluguel", "expectedCents": 150000, "dueDay": 5}))
	created(t, ana.Post("/me/finance/bills", map[string]any{"name": "Internet", "expectedCents": 12000, "dueDay": 20}))
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+rent+"/payments/2026-11", nil), http.StatusNoContent)
	created(t, ana.Post("/me/finance/goals", map[string]any{"name": "Viagem", "targetCents": 500000, "targetMonth": "2027-03"}))
	created(t, ana.Post("/me/finance/investments", map[string]any{"name": "CDB Mercado", "valueCents": 200000, "serves": "reserve"}))
	apitest.ExpectStatus(t, ana.Put("/me/finance/contribution", map[string]any{"baseCents": 100000, "reserveSharePercent": 50}), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Put("/me/finance/reserve", map[string]any{"targetCents": 600000}), http.StatusNoContent)
	created(t, ana.Post("/me/finance/manual-cards", map[string]any{"name": "Cartão da Ana", "dueDay": 10, "pixRecipient": "Ana Souza",
		"bills": map[string]any{"2026-11": 123456, "2026-12": 65432}}))
	exec(t, app, `UPDATE finance_sources SET bill_close_day = 7, bill_due_day = 12 WHERE kind = 'credit_card'`)
	exec(t, app, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT user_id, id, 'plan1', '2026-10-03', -10000, 'BRL', 'Geladeira Fast 2/6', 'GELADEIRA', 'expense', 'auto', 'other', 'fallback', 2, 6, now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com') LIMIT 1`)
	exec(t, app, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT user_id, id, 'plan2', '2026-10-04', -5000, 'BRL', 'PIX ANA SOUZA 1/3', 'PIX ANA SOUZA', 'expense', 'auto', 'other', 'fallback', 1, 3, now(), now()
		FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com') LIMIT 1`)
	exec(t, app, `INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
		SELECT user_id, id, 'b' || i, date '2026-10-07' - make_interval(months => i), date '2026-10-12' - make_interval(months => i), 100000 + 5000 * i
		FROM finance_sources, generate_series(0, 2) i WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`)
}

// callTools asks one question whose model scripts one round of uses, and
// returns the results the model received.
func callTools(t *testing.T, app *apitest.App, ana *apitest.Client, uses ...llmalloc.ToolUse) []llmalloc.ToolResult {
	t.Helper()
	app.Chat.ToolRound(uses...)
	app.Chat.Answer("done")
	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)
	reqs := app.Chat.Requests()
	last := reqs[len(reqs)-1].Messages
	results := last[len(last)-1].ToolResults
	if len(results) != len(uses) {
		t.Fatalf("tool results = %d, want %d", len(results), len(uses))
	}
	return results
}

// within fails for what is in got and not equal in want: every key of got must
// be in want with the same value, and lists must have the same length.
func within(t *testing.T, path string, got, want any) {
	t.Helper()
	switch g := got.(type) {
	case map[string]any:
		w, ok := want.(map[string]any)
		if !ok {
			t.Errorf("%s: route has %T, tool has an object", path, want)
			return
		}
		for k, v := range g {
			wv, ok := w[k]
			if !ok {
				t.Errorf("%s.%s: not in the route's answer", path, k)
				continue
			}
			within(t, path+"."+k, v, wv)
		}
	case []any:
		w, ok := want.([]any)
		if !ok || len(w) != len(g) {
			t.Errorf("%s: tool has %d items, route has %v", path, len(g), want)
			return
		}
		for i := range g {
			within(t, fmt.Sprintf("%s[%d]", path, i), g[i], w[i])
		}
	default:
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%s: tool has %v, route has %v", path, got, want)
		}
	}
}

func decode(t *testing.T, raw string) any {
	t.Helper()
	var v any
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		t.Fatalf("decode %q: %v", raw, err)
	}
	return v
}

// listAt is the list at the path of keys in a decoded object, failing unless it has n items.
func listAt(t *testing.T, v any, n int, keys ...string) []any {
	t.Helper()
	for _, k := range keys {
		m, ok := v.(map[string]any)
		if !ok {
			t.Fatalf("no object at %s in %v", k, v)
		}
		v = m[k]
	}
	l, ok := v.([]any)
	if !ok || len(l) != n {
		t.Fatalf("list at %v = %v, want %d items", keys, v, n)
	}
	return l
}

func TestEachToolReturnsWhatItsRouteReturns(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		use   llmalloc.ToolUse
		route string
		// edit changes the route's answer to what the model should see, from the route's raw text and its decoded form.
		edit  func(raw string) string
		check func(t *testing.T, got any)
	}{
		{"history", use("history", `{"to":"2026-11","months":3}`), "/me/finance/history?to=2026-11&months=3", nil,
			func(t *testing.T, got any) { listAt(t, got, 3, "months") }},
		{"daily", use("daily", `{"month":"2026-11"}`), "/me/finance/daily?month=2026-11", nil,
			func(t *testing.T, got any) { listAt(t, got, 31, "previous") }},
		{"commitments", use("commitments", `{"from":"2026-11","months":2}`), "/me/finance/commitments?from=2026-11",
			func(raw string) string {
				var c map[string]any
				_ = json.Unmarshal([]byte(raw), &c)
				c["months"] = c["months"].([]any)[:2]
				b, _ := json.Marshal(c)
				return strings.NewReplacer(`Cartão da Ana`, `Manual card 1`, `PIX ANA SOUZA`, `Pix sent`).Replace(string(b))
			},
			func(t *testing.T, got any) {
				listAt(t, got, 2, "months")
				m := got.(map[string]any)["months"].([]any)[0]
				listAt(t, m, 2, "cards") // the bank card and the Manual card
				listAt(t, m, 2, "otherBills")
			}},
		{"bills", use("bills", `{"month":"2026-11"}`), "/me/finance/bills?month=2026-11", func(raw string) string { return `{"bills":` + raw + `}` },
			func(t *testing.T, got any) { listAt(t, got, 2, "bills") }},
		{"card_bills", use("card_bills", `{"months":2}`), "", nil,
			func(t *testing.T, got any) {
				cards := listAt(t, got, 1, "cards")
				listAt(t, cards[0], 2, "bills")
			}},
		{"savings", use("savings", `{}`), "/me/finance/savings", nil,
			func(t *testing.T, got any) {
				listAt(t, got, 1, "goals")
				listAt(t, got, 9, "investments")
			}},
		{"net_worth", use("net_worth", `{}`), "/me/finance/net-worth?range=30d", nil,
			func(t *testing.T, got any) {
				if got.(map[string]any)["today"] == nil {
					t.Error("net worth has no today")
				}
			}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana, _ := start(t)
			seedFinances(t, app, ana)
			route := tc.route
			if tc.name == "card_bills" {
				id := fmt.Sprint(scalarText(t, app, `SELECT id FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`))
				route = "/me/finance/card-bills?months=2&source=" + id
			}
			res := ana.Get(route)
			apitest.ExpectStatus(t, res, http.StatusOK)
			raw := string(res.Raw)
			if tc.edit != nil {
				raw = tc.edit(raw)
			}
			want := decode(t, raw)
			if tc.name == "card_bills" { // the route is one card; the tool lists every card
				want = map[string]any{"cards": []any{want}}
				want.(map[string]any)["cards"].([]any)[0].(map[string]any)["name"] = scalarText(t, app, `SELECT COALESCE(display_name, name) FROM finance_sources WHERE kind = 'credit_card' AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`)
			}

			results := callTools(t, app, ana, tc.use)

			if results[0].IsError {
				t.Fatalf("tool error: %s", results[0].Content)
			}
			got := decode(t, results[0].Content)
			within(t, tc.name, got, want)
			tc.check(t, got)
		})
	}
}

func scalarText(t *testing.T, app *apitest.App, query string) string {
	t.Helper()
	var s string
	if err := app.DB.QueryRow(context.Background(), query).Scan(&s); err != nil {
		t.Fatal(err)
	}
	return s
}

// everyTool is one use of each tool, with valid input.
var everyTool = []llmalloc.ToolUse{
	use("month", `{"month":"2026-11"}`), use("history", `{"to":"2026-11","months":12}`), use("daily", `{"month":"2026-11"}`), use("commitments", `{"from":"2026-11","months":12}`),
	use("bills", `{"month":"2026-11"}`), use("card_bills", `{"months":6}`), use("savings", `{}`), use("net_worth", `{}`),
}

// askEveryTool scripts two rounds, four tools each, and an answer.
func askEveryTool(t *testing.T, app *apitest.App, ana *apitest.Client) {
	t.Helper()
	app.Chat.ToolRound(everyTool[:4]...)
	app.Chat.ToolRound(everyTool[4:]...)
	app.Chat.Answer("done")
	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)
	for _, conv := range app.Chat.Requests()[1:] {
		for _, r := range conv.Messages[len(conv.Messages)-1].ToolResults {
			if r.IsError {
				t.Fatalf("tool error: %s", r.Content)
			}
		}
	}
}

func TestAManualCardNeverReachesTheModelByNameOrPixRecipient(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	seedFinances(t, app, ana)

	askEveryTool(t, app, ana)

	all := everything(app)
	if app.Chat.Calls() != 3 {
		t.Fatalf("model calls = %d, want 3", app.Chat.Calls())
	}
	if m := regexp.MustCompile(`(?i)\bana\b|souza|cart.o da`).FindString(all); m != "" {
		t.Errorf("%q reached the model", m)
	}
	commitments := app.Chat.Requests()[1].Messages[2].ToolResults[3].Content
	if !strings.Contains(commitments, "Manual card 1") || !strings.Contains(commitments, "Geladeira") || !strings.Contains(commitments, "123456") {
		t.Errorf("commitments = %.600s, want the Manual card as Manual card 1 with its typed total, and the plan", commitments)
	}
	if !strings.Contains(commitments, "Pix sent") || strings.Contains(commitments, "PIX ANA") {
		t.Errorf("commitments = %.600s, want the installment named for the Manual card redacted", commitments)
	}
}

func TestInvalidArgumentsAreToolErrorsNotFailures(t *testing.T) {
	t.Parallel()
	tests := []struct{ name, tool, input string }{
		{"history over 12 months", "history", `{"to":"2026-11","months":13}`},
		{"history 0 months", "history", `{"to":"2026-11","months":0}`},
		{"history bad month", "history", `{"to":"2026-13","months":3}`},
		{"commitments over 12 months", "commitments", `{"from":"2026-11","months":13}`},
		{"commitments 0 months", "commitments", `{"from":"2026-11","months":0}`},
		{"commitments bad month", "commitments", `{"from":"26-11","months":2}`},
		{"card_bills over 12 months", "card_bills", `{"months":13}`},
		{"card_bills 0 months", "card_bills", `{"months":0}`},
		{"daily month 13", "daily", `{"month":"2026-13"}`},
		{"bills a short year", "bills", `{"month":"26-01"}`},
		{"an extra property", "bills", `{"month":"2026-11","user_id":"x"}`},
		{"a wrong type", "history", `{"to":"2026-11","months":"3"}`},
		{"savings with an argument", "savings", `{"month":"2026-11"}`},
		{"net_worth with an argument", "net_worth", `{"range":"1y"}`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana, _ := start(t)

			results := callTools(t, app, ana, use(tc.tool, tc.input))

			if !results[0].IsError || !strings.Contains(results[0].Content, "expected") {
				t.Errorf("result = %+v, want a tool error saying what is expected", results[0])
			}
		})
	}
}

func TestACardBillsQuestionWithNoCardsOrDataIsEmptyNotAnError(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	exec(t, app, `DELETE FROM finance_sources WHERE kind = 'credit_card'`)

	results := callTools(t, app, ana, use("card_bills", `{"months":6}`), use("commitments", `{"from":"2026-11","months":1}`))

	if results[0].IsError || results[0].Content != `{"cards":[]}` {
		t.Errorf("card_bills = %+v, want an empty list", results[0])
	}
	if results[1].IsError || strings.Contains(results[1].Content, "leftoverCents") || strings.Contains(results[1].Content, "monthlyIncomeCents") {
		t.Errorf("commitments = %s, want no income and no leftover, not zero", results[1].Content)
	}
}

func TestNoToolSendsAnIdACredentialAConnectionOrSomethingToWrite(t *testing.T) {
	t.Parallel()
	want := []string{"bills", "card_bills", "commitments", "daily", "history", "month", "net_worth", "savings"}
	got := []string{}
	results := finchat.ToolResults()
	for name := range results {
		got = append(got, name)
	}
	if len(got) != len(want) {
		t.Fatalf("tools = %v, want exactly %v: a new tool needs review against the ADR's never-sent list", got, want)
	}
	for _, name := range want {
		if results[name] == nil {
			t.Fatalf("tool %s is missing from %v", name, got)
		}
	}
	banned := regexp.MustCompile(`(?i)credential|secret|token|password|item|connect|status|suggest|pantry|pix|recipient|bankname|pluggy`)
	var walk func(path string, ty reflect.Type)
	walk = func(path string, ty reflect.Type) {
		switch ty.Kind() {
		case reflect.Pointer, reflect.Slice, reflect.Array:
			walk(path, ty.Elem())
		case reflect.Map:
			walk(path, ty.Elem())
		case reflect.Struct:
			if ty.NumField() == 0 {
				t.Errorf("%s has no fields", path)
			}
			for i := 0; i < ty.NumField(); i++ {
				f := ty.Field(i)
				if banned.MatchString(f.Name) || strings.HasSuffix(f.Name, "ID") || strings.Contains(strings.ToLower(f.Tag.Get("json")), "pix") {
					t.Errorf("%s.%s may reach the model", path, f.Name)
				}
				walk(path+"."+f.Name, f.Type)
			}
		}
	}
	for name, r := range results {
		walk(name, reflect.TypeOf(r))
	}
}

// snapshot is every row of every finance table and users, as JSON, apart from
// what a question itself writes.
func snapshot(t *testing.T, app *apitest.App) string {
	t.Helper()
	var sb strings.Builder
	rows, err := app.DB.Query(context.Background(), `SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND (table_name = 'users' OR table_name LIKE 'finance\_%') AND table_name <> 'finance_chat_calls' ORDER BY 1`)
	if err != nil {
		t.Fatal(err)
	}
	tables, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil || len(tables) < 20 {
		t.Fatalf("finance tables = %v, %v", tables, err)
	}
	for _, tbl := range tables {
		var rows string
		if err := app.DB.QueryRow(context.Background(), `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]')::text FROM `+tbl+` t`).Scan(&rows); err != nil {
			t.Fatalf("snapshot %s: %v", tbl, err)
		}
		sb.WriteString(tbl + rows)
	}
	return sb.String()
}

func TestAQuestionThatUsesEveryToolChangesNothing(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	seedFinances(t, app, ana)
	before := snapshot(t, app)
	if len(before) < 1000 {
		t.Fatalf("snapshot of %d bytes is too small to prove anything", len(before))
	}

	askEveryTool(t, app, ana)

	if after := snapshot(t, app); after != before {
		t.Error("the database changed after a question that used every tool")
	}
}
