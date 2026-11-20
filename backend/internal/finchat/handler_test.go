package finchat_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/finchat"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

// afterFixtures is the fake clock: 2026-11-08 09:00 in São Paulo.
var afterFixtures = time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)

const (
	qMarker = "QUESTIONMARKER"
	aMarker = "ANSWERMARKER"
)

// start boots the API with the chat and two allowlisted Users whose Finances
// are synced from the fake Pluggy.
func start(t *testing.T, opts ...apitest.Option) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	opts = append([]apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bia@example.com"),
		apitest.WithPluggy(), apitest.WithChat()}, opts...)
	app := apitest.Start(t, opts...)
	app.Clock.Set(afterFixtures)
	var cs []*apitest.Client
	for _, e := range []string{"ana@example.com", "bia@example.com"} {
		c := app.SignInAs(e)
		apitest.ExpectStatus(t, c.Put("/me/finance/credentials", map[string]string{"clientId": pluggytest.ClientID, "clientSecret": pluggytest.ClientSecret}), http.StatusNoContent)
		apitest.ExpectStatus(t, c.Post("/me/finance/items", map[string]string{"itemId": pluggytest.ItemID}), http.StatusOK)
		cs = append(cs, c)
	}
	app.RunFinanceSync(t)
	return app, cs[0], cs[1]
}

// seed adds a November Transaction to the User's checking Source.
func seed(t *testing.T, app *apitest.App, email, description, typ string, cents int64) {
	t.Helper()
	tag, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, $1, '2026-11-03', $2, 'BRL', $1, $1, $3, 'auto',
			CASE WHEN $3 = 'expense' THEN 'groceries' END, 'user', now(), now()
		FROM finance_sources WHERE kind = 'checking' AND user_id = (SELECT id FROM users WHERE email = $4) LIMIT 1`,
		description, cents, typ, email)
	if err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("seed %s: %v", description, err)
	}
}

func userID(t *testing.T, app *apitest.App, email string) string {
	t.Helper()
	var id string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM users WHERE email = $1`, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func scalar(t *testing.T, app *apitest.App, query string, args ...any) (n int64) {
	t.Helper()
	if err := app.DB.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

func msg(role, text string) map[string]string { return map[string]string{"role": role, "text": text} }

func body(messages ...map[string]string) map[string]any {
	return map[string]any{"screen": "overview", "locale": "pt-BR", "messages": messages}
}

func ask(c *apitest.Client, question string) apitest.Response {
	return c.Post("/me/finance/chat", body(msg("user", question)))
}

func month(m string) llmalloc.ToolUse {
	return llmalloc.ToolUse{Name: "month", Input: json.RawMessage(`{"month":"` + m + `"}`)}
}

func chatEvents(t *testing.T, app *apitest.App, outcome string) int64 {
	t.Helper()
	return scalar(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'chat' AND outcome = $1`, outcome)
}

// everything is every text the fake model received, in all its requests.
func everything(app *apitest.App) string {
	var sb strings.Builder
	for _, conv := range app.Chat.Requests() {
		sb.WriteString(conv.System)
		for _, tl := range conv.Tools {
			sb.WriteString(tl.Name + tl.Description)
		}
		for _, m := range conv.Messages {
			sb.WriteString(m.Text)
			for _, u := range m.ToolUses {
				sb.Write(u.Input)
			}
			for _, r := range m.ToolResults {
				sb.WriteString(r.Content)
			}
		}
	}
	return sb.String()
}

func TestAQuestionIsAnsweredAfterOneToolRound(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	seed(t, app, "ana@example.com", "MERCADO CENTRAL", "expense", -12345)
	app.Chat.ToolRound(month("2026-11"))
	app.Chat.Answer(aMarker)

	res := ask(ana, qMarker)

	apitest.ExpectStatus(t, res, http.StatusOK)
	if res.Body["answer"] != aMarker || res.Body["remaining"] != float64(19) {
		t.Fatalf("response = %s, want the answer and remaining 19", res.Raw)
	}
	if app.Chat.Calls() != 2 {
		t.Fatalf("model calls = %d, want 2", app.Chat.Calls())
	}
	second := app.Chat.Requests()[1].Messages
	if len(second) != 3 || len(second[2].ToolResults) != 1 || !strings.Contains(second[2].ToolResults[0].Content, "MERCADO CENTRAL") {
		t.Errorf("second request = %+v, want the question, the tool use and a result with the month", second)
	}
	if n := chatEvents(t, app, "accepted"); n != 2 {
		t.Errorf("accepted chat events = %d, want 2", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'chat' AND home_id IS NULL AND run_id IS NULL AND est_cost_micros > 0`); n != 2 {
		t.Errorf("costed events with no Home or run = %d, want 2", n)
	}
	if sent := scalar(t, app, `SELECT sum(items_sent) FROM llm_call_events WHERE service = 'chat'`); sent != 1 {
		t.Errorf("items_sent over both calls = %d, want 1 tool use", sent)
	}
	var rows string
	if err := app.DB.QueryRow(context.Background(), `SELECT string_agg(row_to_json(e)::text, ' ') FROM llm_call_events e WHERE service = 'chat'`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	for _, text := range []string{qMarker, aMarker, "MERCADO"} {
		if strings.Contains(rows, text) {
			t.Errorf("event rows hold %q: %s", text, rows)
		}
	}
	if n := scalar(t, app, `SELECT questions FROM finance_chat_calls WHERE user_id = $1`, userID(t, app, "ana@example.com")); n != 1 {
		t.Errorf("questions counted = %d, want 1", n)
	}
	for _, text := range []string{qMarker, aMarker, "MERCADO"} {
		if app.Logs.Contains(text) {
			t.Errorf("logs hold %q", text)
		}
	}
}

func TestTheGates(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"), apitest.WithChat())
	if res := ask(app.SignInAs("eve@example.com"), "hi"); res.Status != http.StatusForbidden {
		t.Errorf("off the allowlist = %d %s, want 403", res.Status, res.Raw)
	}
	if app.Chat.Calls() != 0 {
		t.Error("the model was called for a User off the allowlist")
	}

	noModel := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	res := ask(noModel.SignInAs("ana@example.com"), "hi")
	if res.Status != http.StatusServiceUnavailable || res.Body["error"] != "chat_unavailable" {
		t.Errorf("no model key = %d %s, want 503 chat_unavailable", res.Status, res.Raw)
	}
}

func TestInvalidBodiesAreRefusedWithoutEchoingThem(t *testing.T) {
	t.Parallel()
	const m = "SECRETMARKER"
	long := func(n int) string { return m + strings.Repeat("é", n-len(m)) }
	with := func(f func(map[string]any)) map[string]any {
		b := body(msg("user", m))
		f(b)
		return b
	}
	many := func(n int, last string) []map[string]string {
		var out []map[string]string
		for i := 0; i < n; i++ {
			role := "assistant"
			if (n-1-i)%2 == 0 {
				role = last
			}
			out = append(out, msg(role, m))
		}
		return out
	}
	bad := []struct {
		name string
		raw  any
	}{
		{"unknown screen", with(func(b map[string]any) { b["screen"] = m })},
		{"locale en-US", with(func(b map[string]any) { b["locale"] = "en-US" })},
		{"no messages", with(func(b map[string]any) { b["messages"] = []any{} })},
		{"13 messages", with(func(b map[string]any) { b["messages"] = many(13, "user") })},
		{"two user messages in a row", body(msg("user", m), msg("user", m))},
		{"last message from the assistant", body(msg("user", m), msg("assistant", m))},
		{"only an assistant message", body(msg("assistant", m))},
		{"unknown role", body(msg("system", m))},
		{"501-rune question", body(msg("user", long(501)))},
		{"blank question", body(msg("user", "  \n "))},
		{"4001-rune earlier answer", body(msg("user", m), msg("assistant", long(4001)), msg("user", m))},
		{"control character", body(msg("user", m+"\x07"))},
		{"unknown top-level field", with(func(b map[string]any) { b["extra"] = m })},
		{"malformed JSON", `{"screen":"overview","locale":"pt-BR","messages":[{"role":"user","text":"` + m},
	}
	app, ana, _ := start(t)
	for _, tc := range bad {
		var res apitest.Response
		if s, ok := tc.raw.(string); ok {
			res = ana.SendRaw(http.MethodPost, "/me/finance/chat", []byte(s))
		} else {
			res = ana.Post("/me/finance/chat", tc.raw)
		}
		if res.Status != http.StatusBadRequest || strings.Contains(string(res.Raw), m) {
			t.Errorf("%s: %d %s, want 400 without the body", tc.name, res.Status, res.Raw)
		}
	}
	if app.Chat.Calls() != 0 || scalar(t, app, `SELECT count(*) FROM finance_chat_calls`) != 0 {
		t.Error("an invalid body reached the model or counted as a question")
	}

	// Both ends of the accepted range.
	app.Chat.Answer("ok")
	apitest.ExpectStatus(t, ask(ana, strings.Repeat("é", 500)), http.StatusOK)
	app.Chat.Answer("ok")
	twelve := body(many(12, "user")...)
	twelve["messages"].([]map[string]string)[2] = msg("user", "x") // two user messages in a row
	apitest.ExpectStatus(t, ana.Post("/me/finance/chat", twelve), http.StatusBadRequest)
	apitest.ExpectStatus(t, ana.Post("/me/finance/chat", body(many(12, "user")...)), http.StatusOK)
	req := app.Chat.Requests()[1].Messages
	if len(req) != 11 || req[0].Role != llmalloc.RoleUser {
		t.Errorf("12 messages reached the model as %d starting with %q, want 11 starting with user", len(req), req[0].Role)
	}
}

// at0100UTC is 22:00 on 2026-11-08 in São Paulo.
var at0100UTC = time.Date(2026, 11, 9, 1, 0, 0, 0, time.UTC)

func setQuestions(t *testing.T, app *apitest.App, email, date string, n int) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `INSERT INTO finance_chat_calls (user_id, call_date, questions) VALUES ($1, $2, $3)`,
		userID(t, app, email), date, n); err != nil {
		t.Fatal(err)
	}
}

func TestTheDailyLimitFollowsTheSaoPauloDay(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		seedDate   string
		seedEmail  string
		wantStatus int
	}{
		{"20 on the São Paulo day", "2026-11-08", "ana@example.com", http.StatusTooManyRequests},
		{"20 on the UTC date only", "2026-11-09", "ana@example.com", http.StatusOK},
		{"20 on another User", "2026-11-08", "bia@example.com", http.StatusOK},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana, _ := start(t)
			app.Clock.Set(at0100UTC)
			setQuestions(t, app, tc.seedEmail, tc.seedDate, 20)
			app.Chat.Answer("ok")

			res := ask(ana, "hi")

			if res.Status != tc.wantStatus {
				t.Fatalf("21st question = %d %s, want %d", res.Status, res.Raw, tc.wantStatus)
			}
			refused := tc.wantStatus == http.StatusTooManyRequests
			if refused && (res.Body["error"] != "chat_daily_limit" || app.Chat.Calls() != 0 || chatEvents(t, app, "skipped_cap") != 1) {
				t.Errorf("refused = %s, model calls %d, skipped_cap %d; want chat_daily_limit, 0 and 1", res.Raw, app.Chat.Calls(), chatEvents(t, app, "skipped_cap"))
			}
			if !refused && (res.Body["remaining"] != float64(19) || chatEvents(t, app, "skipped_cap") != 0) {
				t.Errorf("answered = %s, want remaining 19 and no skipped_cap", res.Raw)
			}
		})
	}
}

func TestAFailedQuestionStillCounts(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		script      func(*llmalloc.ScriptedClient)
		status      int
		outcome     string
		wantCostRow bool
	}{
		{"error without usage", func(s *llmalloc.ScriptedClient) { s.Fail(errors.New("boom")) }, 502, "error", false},
		{"error with usage", func(s *llmalloc.ScriptedClient) { s.FailWithUsage(errors.New("boom")) }, 502, "error", true},
		{"invalid response", func(s *llmalloc.ScriptedClient) { s.FailWithUsage(llmalloc.ErrInvalidResponse) }, 502, "invalid_response", true},
		{"an answer too long to send back", func(s *llmalloc.ScriptedClient) { s.Answer(strings.Repeat("é", 4001)) }, 502, "invalid_response", true},
		{"the round limit", func(s *llmalloc.ScriptedClient) {
			for range finchat.MaxRounds + 1 {
				s.ToolRound(month("2026-11"))
			}
		}, 504, "invalid_response", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana, _ := start(t)
			tc.script(app.Chat)

			res := ask(ana, "hi")

			if res.Status != tc.status || res.Body["error"] != "chat_unavailable" {
				t.Fatalf("= %d %s, want %d chat_unavailable", res.Status, res.Raw, tc.status)
			}
			if n := scalar(t, app, `SELECT questions FROM finance_chat_calls`); n != 1 {
				t.Errorf("questions counted = %d, want 1", n)
			}
			if chatEvents(t, app, tc.outcome) != 1 {
				t.Errorf("no %s event", tc.outcome)
			}
			costed := scalar(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'chat' AND outcome = $1 AND est_cost_micros IS NOT NULL`, tc.outcome)
			if (costed == 1) != tc.wantCostRow {
				t.Errorf("costed %s events = %d, want %v", tc.outcome, costed, tc.wantCostRow)
			}
		})
	}
}

func TestTheRoundLimitCallsTheModelFiveTimes(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	for range finchat.MaxRounds + 2 {
		app.Chat.ToolRound(month("2026-11"))
	}
	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusGatewayTimeout)
	if app.Chat.Calls() != 5 {
		t.Errorf("model calls = %d, want 5", app.Chat.Calls())
	}
}

// Not parallel: it shortens a package variable, and parallel tests wait until it ends.
func TestAQuestionThatTakesTooLongIsA504(t *testing.T) {
	defer finchat.SetQuestionTimeout(100 * time.Millisecond)()
	app, ana, _ := start(t)
	app.Chat.Block()

	res := ask(ana, "hi")

	if res.Status != http.StatusGatewayTimeout || res.Body["error"] != "chat_unavailable" {
		t.Fatalf("= %d %s, want 504 chat_unavailable", res.Status, res.Raw)
	}
	if chatEvents(t, app, "timeout") != 1 || scalar(t, app, `SELECT questions FROM finance_chat_calls`) != 1 {
		t.Error("want one timeout event and a counted question")
	}
}

func TestToolsAreScopedAndValidated(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		use   llmalloc.ToolUse
		wantE string
	}{
		{"another User's id as an argument", llmalloc.ToolUse{Name: "month", Input: json.RawMessage(`{"month":"2026-11","user_id":"BIAID"}`)}, `invalid input: expected {"month":"YYYY-MM"}`},
		{"a bad month", month("2026-13"), "invalid month: use YYYY-MM"},
		{"an unknown tool", llmalloc.ToolUse{Name: "delete_everything", Input: json.RawMessage(`{}`)}, "unknown tool"},
		{"input that is not an object", llmalloc.ToolUse{Name: "month", Input: json.RawMessage(`"2026-11"`)}, `invalid input: expected {"month":"YYYY-MM"}`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, ana, _ := start(t)
			seed(t, app, "bia@example.com", "BIAPRIVATESHOP", "expense", -999)
			tc.use.Input = json.RawMessage(strings.ReplaceAll(string(tc.use.Input), "BIAID", userID(t, app, "bia@example.com")))
			app.Chat.ToolRound(tc.use)
			app.Chat.Answer("done")

			res := ask(ana, "hi")

			apitest.ExpectStatus(t, res, http.StatusOK)
			results := app.Chat.Requests()[1].Messages[2].ToolResults
			if len(results) != 1 || !results[0].IsError || results[0].Content != tc.wantE {
				t.Errorf("tool results = %+v, want one error %q", results, tc.wantE)
			}
			if strings.Contains(everything(app), "BIAPRIVATESHOP") {
				t.Error("another User's Transaction reached the model")
			}
		})
	}
}

func TestOnlyTheFirstFourToolUsesOfARoundRun(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	app.Chat.ToolRound(month("2026-11"), month("2026-11"), month("2026-11"), month("2026-11"), month("2026-11"))
	app.Chat.Answer("done")

	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)

	results := app.Chat.Requests()[1].Messages[2].ToolResults
	if len(results) != 5 || results[3].IsError || !results[4].IsError || results[4].Content != "too many tool calls" {
		t.Errorf("tool results = %+v, want the fifth refused", results)
	}
}

func TestNoNameOfAPersonReachesTheModel(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	seed(t, app, "ana@example.com", "PIX ENVIADO MARIA SILVA", "expense", -5000)
	seed(t, app, "ana@example.com", "Pix recebido - Maria Silva", "income", 7000)
	seed(t, app, "ana@example.com", "TED MARIA SILVA", "expense", -2000)
	seed(t, app, "ana@example.com", "PIX*MARIA SILVA", "transfer", -1000)
	seed(t, app, "ana@example.com", "PAGAMENTO CARTAO MARIA SILVA", "expense", -3000)
	apitest.ExpectStatus(t, ana.Post("/me/finance/manual-cards", map[string]any{"name": "Cartao Verde", "dueDay": 10, "pixRecipient": "Maria Silva"}), http.StatusCreated)
	app.Chat.ToolRound(month("2026-11"))
	app.Chat.Answer("done")

	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)

	seen := everything(app)
	for _, name := range []string{"MARIA", "Maria", "maria", "SILVA"} {
		if strings.Contains(seen, name) {
			t.Errorf("the model received %q", name)
		}
	}
	for _, want := range []string{"Pix sent", "Pix received", "TED sent", "Manual card 1 payment"} {
		if !strings.Contains(seen, want) {
			t.Errorf("the model did not receive %q, so the redaction did not run", want)
		}
	}
	for _, id := range []string{"sourceId", "typeSetBy", `"id"`} {
		if strings.Contains(seen, id) {
			t.Errorf("the model received %s", id)
		}
	}
}

func TestDeletingFinanceDataClearsTheCounts(t *testing.T) {
	t.Parallel()
	app, ana, bia := start(t)
	app.Chat.Answer("ok")
	app.Chat.Answer("ok")
	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)
	apitest.ExpectStatus(t, ask(bia, "hi"), http.StatusOK)

	apitest.ExpectStatus(t, ana.Delete("/me/finance"), http.StatusNoContent)

	if n := scalar(t, app, `SELECT count(*) FROM finance_chat_calls WHERE user_id = $1`, userID(t, app, "ana@example.com")); n != 0 {
		t.Errorf("Ana's chat counts left = %d, want 0", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_chat_calls WHERE user_id = $1`, userID(t, app, "bia@example.com")); n != 1 {
		t.Errorf("Bia's chat counts = %d, want 1", n)
	}
}

func TestAdminSeesTheChatRows(t *testing.T) {
	t.Parallel()
	app, ana, _ := start(t)
	app.Chat.Answer("ok")
	apitest.ExpectStatus(t, ask(ana, "hi"), http.StatusOK)

	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=7d")

	apitest.ExpectStatus(t, res, http.StatusOK)
	var got struct {
		Days []struct{ Services admin.AIServices }
	}
	if err := json.Unmarshal(res.Raw, &got); err != nil {
		t.Fatal(err)
	}
	if last := got.Days[len(got.Days)-1].Services.Chat; last.Outcomes.Accepted != 1 {
		t.Errorf("chat = %+v, want one accepted call", last)
	}
}
