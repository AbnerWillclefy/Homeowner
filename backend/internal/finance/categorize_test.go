package finance_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// In the fixtures, three Expenses have no category Pluggy's map decides. In
// merchant_key order they are the Categorizer's indexes 0, 1 and 2:
// PAGAMENTO DE BOLETO, PAGAMENTO FATURA CARTAO VISA, SYNTHETIC SECOND PAGE DEBIT.
const (
	allThree = `{"items":[{"i":0,"c":"taxes_fees"},{"i":1,"c":"other"},{"i":2,"c":"groceries"}]}`
)

func categoryOf(t *testing.T, app *apitest.App, key string) (category, setBy string) {
	t.Helper()
	err := app.DB.QueryRow(context.Background(),
		`SELECT spending_category, category_set_by FROM finance_transactions WHERE merchant_key = $1 LIMIT 1`, key).Scan(&category, &setBy)
	if err != nil {
		t.Fatalf("category of %s: %v", key, err)
	}
	return category, setBy
}

func startCategorizing(t *testing.T, answer string) (*apitest.App, *llmalloc.FakeClient) {
	t.Helper()
	app, _ := startSync(t, []string{ana})
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	app.UseCategorizer(fake)
	return app, fake
}

func TestACorrectionBeatsPluggyAndPluggyBeatsTheCategorizer(t *testing.T) {
	t.Parallel()
	app, fake := startCategorizing(t, allThree)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_merchant_categories (user_id, merchant_key, spending_category, updated_at)
		SELECT id, 'NETFLIX COM', 'leisure', now() FROM users WHERE email = $1`, ana); err != nil {
		t.Fatal(err)
	}
	app.RunFinanceSync(t)

	for key, want := range map[string][2]string{
		"NETFLIX COM":                  {"leisure", "auto"},         // the correction beats Pluggy's "Video streaming"
		"SPOTIFY AB":                   {"subscriptions", "auto"},   // Pluggy's "Music streaming"
		"SMART FIT ACADEMIA":           {"health", "auto"},          // Pluggy's "Gyms and fitness centers"
		"CONDOMINIO EDIFICIO SOLAR":    {"housing", "auto"},         // Pluggy's "Housing"
		"ELETROBRAS LIGHT SA":          {"household_bills", "auto"}, // Pluggy's "Electricity"
		"VIVO SERVICOS E COMERCIO":     {"household_bills", "auto"},
		"PAGAMENTO DE BOLETO":          {"taxes_fees", "auto"}, // the Categorizer
		"PAGAMENTO FATURA CARTAO VISA": {"other", "auto"},      // the Categorizer chose Other: decided, not a fallback
		"SYNTHETIC SECOND PAGE DEBIT":  {"groceries", "auto"},
	} {
		if c, by := categoryOf(t, app, key); c != want[0] || by != want[1] {
			t.Errorf("%s = %s/%s, want %s/%s", key, c, by, want[0], want[1])
		}
	}
	if fake.Calls() != 1 {
		t.Fatalf("categorizer calls = %d, want 1 for all the merchants Go could not decide", fake.Calls())
	}
	// Only what neither the User nor Pluggy decided reaches the model.
	user := fake.LastRequest().User
	for _, decided := range []string{"NETFLIX", "SPOTIFY", "SMART FIT", "CONDOMINIO", "ELETROBRAS", "VIVO", "SALARIO"} {
		if strings.Contains(user, decided) {
			t.Errorf("the prompt holds %q, which was decided before it", decided)
		}
	}
}

func TestOnlyExpensesGetACategory(t *testing.T) {
	t.Parallel()
	app, _ := startCategorizing(t, allThree)
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE type <> 'expense'`); n == 0 {
		t.Fatal("setup: the fixtures hold no Income")
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE type <> 'expense' AND (spending_category IS NOT NULL OR category_set_by IS NOT NULL)`); n != 0 {
		t.Errorf("%d rows that are not Expenses have a category", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE type = 'expense' AND spending_category IS NULL`); n != 0 {
		t.Errorf("%d Expenses have no category", n)
	}
}

func TestPastTheCapTheExpensesStayOtherAndAreRetriedOnALaterDay(t *testing.T) {
	t.Parallel()
	app, fake := startCategorizing(t, allThree)
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_llm_calls (user_id, call_date, calls)
		SELECT id, '2026-11-08', 10 FROM users WHERE email = $1`, ana); err != nil {
		t.Fatal(err)
	}
	app.RunFinanceSync(t)
	if fake.Calls() != 0 {
		t.Fatalf("calls = %d, want none past the cap", fake.Calls())
	}
	if c, by := categoryOf(t, app, "SYNTHETIC SECOND PAGE DEBIT"); c != "other" || by != "fallback" {
		t.Errorf("past the cap = %s/%s, want other/fallback", c, by)
	}
	if n := scalar(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'categorizer' AND outcome = 'skipped_cap' AND latency_ms IS NULL`); n != 1 {
		t.Errorf("skipped_cap events = %d, want 1", n)
	}

	app.Clock.Advance(24 * time.Hour)
	app.RunFinanceSync(t)
	if fake.Calls() != 1 {
		t.Fatalf("calls = %d, want 1 the next day", fake.Calls())
	}
	if c, by := categoryOf(t, app, "SYNTHETIC SECOND PAGE DEBIT"); c != "groceries" || by != "auto" {
		t.Errorf("the next day = %s/%s, want groceries/auto", c, by)
	}
}

func TestTheCapIsPerUserAndPerDay(t *testing.T) {
	t.Parallel()
	app, fake := startCategorizing(t, `{"items":[]}`) // the model answers for nobody: every run asks again
	for run := 0; run < 12; run++ {                   // hourly runs, all on the same day in São Paulo
		app.RunFinanceSync(t)
		app.Clock.Advance(time.Hour)
	}
	if fake.Calls() != 10 {
		t.Errorf("calls in a day of hourly runs = %d, want the cap of 10", fake.Calls())
	}
}

func TestAnUnanswerableMerchantStaysOtherAndFallback(t *testing.T) {
	t.Parallel()
	app, _ := startCategorizing(t, `{"items":[{"i":2,"c":"pets"}]}`)
	app.RunFinanceSync(t)
	if c, by := categoryOf(t, app, "PAGAMENTO DE BOLETO"); c != "other" || by != "fallback" {
		t.Errorf("unanswered = %s/%s, want other/fallback", c, by)
	}
	if c, by := categoryOf(t, app, "SYNTHETIC SECOND PAGE DEBIT"); c != "pets" || by != "auto" {
		t.Errorf("answered = %s/%s, want pets/auto", c, by)
	}
}

func TestACategoryTheUserSetIsNeverTouched(t *testing.T) {
	t.Parallel()
	app, _ := startCategorizing(t, allThree)
	app.RunFinanceSync(t)
	if _, err := app.DB.Exec(context.Background(),
		`UPDATE finance_transactions SET spending_category = 'pets', category_set_by = 'user' WHERE merchant_key = 'SPOTIFY AB'`); err != nil {
		t.Fatal(err)
	}
	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)
	if c, by := categoryOf(t, app, "SPOTIFY AB"); c != "pets" || by != "user" {
		t.Errorf("got %s/%s, want pets/user kept", c, by)
	}
}

func TestEachAttemptLeavesAnEventWithCountsAndCostOnly(t *testing.T) {
	t.Parallel()
	app, _ := startCategorizing(t, allThree)
	app.RunFinanceSync(t)
	var service, outcome, model string
	var home, run *string
	var sent, accepted, in, out, cost *int64
	var date string
	err := app.DB.QueryRow(context.Background(), `
		SELECT service, outcome, model, home_id::text, run_id::text, items_sent, items_accepted, input_tokens, output_tokens,
		       est_cost_micros, local_date::text
		FROM llm_call_events`).Scan(&service, &outcome, &model, &home, &run, &sent, &accepted, &in, &out, &cost, &date)
	if err != nil {
		t.Fatal(err)
	}
	if service != "categorizer" || outcome != "accepted" || home != nil || run != nil || date != "2026-11-08" {
		t.Errorf("event = %s %s home=%v run=%v %s", service, outcome, home, run, date)
	}
	if sent == nil || *sent != 3 || accepted == nil || *accepted != 3 || in == nil || out == nil || cost == nil || *cost <= 0 {
		t.Errorf("counts = sent %v accepted %v in %v out %v cost %v", sent, accepted, in, out, cost)
	}
	// The table has no column that names a User.
	if n := scalar(t, app, `SELECT count(*) FROM information_schema.columns WHERE table_name = 'llm_call_events' AND column_name ILIKE '%user%'`); n != 0 {
		t.Errorf("llm_call_events has %d user columns", n)
	}
}

func TestABrokenAnswerIsRecordedAndTheExpensesStayOther(t *testing.T) {
	t.Parallel()
	app, _ := startCategorizing(t, `{"items":[{"i":0,"c":"crypto"}]}`)
	app.RunFinanceSync(t)
	if n := scalar(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'categorizer' AND outcome = 'invalid_response' AND items_accepted IS NULL`); n != 1 {
		t.Errorf("invalid_response events = %d, want 1", n)
	}
	if c, by := categoryOf(t, app, "PAGAMENTO DE BOLETO"); c != "other" || by != "fallback" {
		t.Errorf("got %s/%s, want other/fallback", c, by)
	}
}

func TestWithoutACategorizerTheExpensesNeitherSideDecidedStayOther(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{ana})
	app.RunFinanceSync(t)
	if c, by := categoryOf(t, app, "SPOTIFY AB"); c != "subscriptions" || by != "auto" {
		t.Errorf("Pluggy's step = %s/%s, want subscriptions/auto", c, by)
	}
	if c, by := categoryOf(t, app, "PAGAMENTO DE BOLETO"); c != "other" || by != "fallback" {
		t.Errorf("got %s/%s, want other/fallback", c, by)
	}
	if n := scalar(t, app, `SELECT count(*) FROM llm_call_events`); n != 0 {
		t.Errorf("events = %d, want none without a Categorizer", n)
	}
}

func TestTheDatabaseRefusesACategoryOutsideTheThirteen(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{ana})
	app.RunFinanceSync(t)
	_, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_merchant_categories (user_id, merchant_key, spending_category, updated_at)
		SELECT id, 'X', 'crypto', now() FROM users WHERE email = $1`, ana)
	if err == nil {
		t.Error("a correction with a category outside the 13 was stored")
	}
	_, err = app.DB.Exec(context.Background(), `UPDATE finance_transactions SET spending_category = 'crypto' WHERE merchant_key = 'SPOTIFY AB'`)
	if err == nil {
		t.Error("a Transaction with a category outside the 13 was stored")
	}
}

func TestMoreThanOneBatchMapsEachAnswerToItsOwnKeyAndTransfersNeverLeave(t *testing.T) {
	t.Parallel()
	app, _ := startSync(t, []string{ana})
	app.RunFinanceSync(t) // no Categorizer yet: the fixtures' Expenses are on fallback
	n := llmalloc.MaxCategorizerBatch + 5
	if _, err := app.DB.Exec(context.Background(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
		       merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, source_id, 'bulk-' || k, posted_on, amount_cents, currency, description,
		       CASE WHEN k = 0 THEN 'PAGAMENTO PIX FULANO' ELSE 'MERCHANT ' || lpad(k::text, 3, '0') END,
		       type, type_set_by, 'other', 'fallback', created_at, updated_at
		FROM (SELECT * FROM finance_transactions WHERE category_set_by = 'fallback' LIMIT 1) t, generate_series(0, $1::int) k`, n); err != nil {
		t.Fatal(err)
	}
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"items":[{"i":0,"c":"pets"}]}`) // the first merchant of whichever batch is asked
	app.UseCategorizer(fake)
	app.RunFinanceSync(t)

	// 105 bulk merchants + 3 from the fixtures = 108 sendable, so two batches.
	if fake.Calls() != 2 {
		t.Fatalf("calls = %d, want 2", fake.Calls())
	}
	if strings.Contains(fake.LastRequest().User, "PIX") {
		t.Error("a PIX key went to the model")
	}
	if c, by := categoryOf(t, app, "MERCHANT 101"); c != "pets" || by != "auto" {
		t.Errorf("first of the second batch = %s/%s, want pets/auto", c, by)
	}
	if c, by := categoryOf(t, app, "MERCHANT 002"); c != "other" || by != "fallback" {
		t.Errorf("second of the first batch = %s/%s, want other/fallback", c, by)
	}
	if c, by := categoryOf(t, app, "PAGAMENTO PIX FULANO"); c != "other" || by != "fallback" {
		t.Errorf("held back = %s/%s, want other/fallback", c, by)
	}
}
