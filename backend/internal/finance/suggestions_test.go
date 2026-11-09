package finance_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type suggestionBody struct {
	MerchantKey, Name string
	AmountCents       int64
	DueDay            int
}

func suggestions(t *testing.T, c *apitest.Client) []suggestionBody {
	t.Helper()
	res := c.Get("/me/finance/bill-suggestions")
	apitest.ExpectStatus(t, res, http.StatusOK)
	out := []suggestionBody{}
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// addCharge stores an Expense of the User on their first Source, with the
// merchant key the sync would give it.
func addCharge(t *testing.T, app *apitest.App, email, description string, cents int64, day string) {
	t.Helper()
	if _, err := app.DB.Exec(t.Context(), `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT s.user_id, s.id, 'sug-' || $1::text || $3::text, $3::date, -$2::bigint, 'BRL', $1, $5, 'expense', 'auto', 'other', 'fallback', now(), now()
		FROM finance_sources s JOIN users u ON u.id = s.user_id WHERE u.email = $4 ORDER BY s.id LIMIT 1`,
		description, cents, day, email, finance.MerchantKey(description)); err != nil {
		t.Fatal(err)
	}
}

// monthly gives a User a charge on the 8th of August, September and October 2026.
func monthly(t *testing.T, app *apitest.App, email, description string, cents int64) {
	t.Helper()
	for _, d := range []string{"2026-08-08", "2026-09-08", "2026-10-08"} {
		addCharge(t, app, email, description, cents, d)
	}
}

func startSuggest(t *testing.T) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	app.Clock.Set(time.Date(2026, time.November, 10, 12, 0, 0, 0, time.UTC))
	return app, users["ana@example.com"], users["bia@example.com"]
}

func TestAMonthlyChargeIsSuggestedOnlyToItsUser(t *testing.T) {
	t.Parallel()
	app, ana, bia := startSuggest(t)
	if got := suggestions(t, ana); got == nil || len(got) != 0 {
		t.Fatalf("before any charge = %+v, want []", got)
	}
	monthly(t, app, "ana@example.com", "NETFLIX.COM", 3990)

	got := suggestions(t, ana)
	if len(got) != 1 || got[0] != (suggestionBody{"NETFLIX COM", "NETFLIX", 3990, 8}) {
		t.Errorf("suggestions = %+v", got)
	}
	if got := suggestions(t, bia); len(got) != 0 {
		t.Errorf("another User sees %+v", got)
	}
	if res := app.SignInAs("bob@example.com").Get("/me/finance/bill-suggestions"); res.Status != http.StatusForbidden {
		t.Errorf("GET as a User off the allowlist = %d, want 403", res.Status)
	}
	if res := app.SignInAs("bob@example.com").Post("/me/finance/bill-suggestions/dismissals", map[string]string{"merchantKey": "NETFLIX"}); res.Status != http.StatusForbidden {
		t.Errorf("POST as a User off the allowlist = %d, want 403", res.Status)
	}
}

func TestAnExistingBillHidesTheSuggestion(t *testing.T) {
	t.Parallel()
	app, ana, _ := startSuggest(t)
	monthly(t, app, "ana@example.com", "SPOTIFY", 2190)
	newBill(t, ana, "Spotify", 2190, 8)
	if got := suggestions(t, ana); len(got) != 0 {
		t.Errorf("covered merchant suggested: %+v", got)
	}
}

func TestDismissingHidesASuggestionForGoodAndIsIdempotent(t *testing.T) {
	t.Parallel()
	app, ana, bia := startSuggest(t)
	monthly(t, app, "ana@example.com", "SPOTIFY", 2190)
	monthly(t, app, "bia@example.com", "SPOTIFY", 2190)

	for range 2 {
		apitest.ExpectStatus(t, ana.Post("/me/finance/bill-suggestions/dismissals", map[string]string{"merchantKey": "SPOTIFY"}), http.StatusNoContent)
	}
	if got := suggestions(t, ana); len(got) != 0 {
		t.Errorf("dismissed suggestion returned: %+v", got)
	}
	if got := suggestions(t, bia); len(got) != 1 {
		t.Errorf("dismissal leaked to another User: %+v", got)
	}
	// A key that matches nothing is fine: dismissing cannot probe other data.
	apitest.ExpectStatus(t, ana.Post("/me/finance/bill-suggestions/dismissals", map[string]string{"merchantKey": "NOTHING AT ALL"}), http.StatusNoContent)
}

func TestADismissalWithABadKeyIs400(t *testing.T) {
	t.Parallel()
	_, ana, _ := startSuggest(t)
	for name, key := range map[string]string{"empty": "", "lowercase": "netflix", "digit": "NETFLIX 2", "long": strings.Repeat("A", 201)} {
		res := ana.Post("/me/finance/bill-suggestions/dismissals", map[string]string{"merchantKey": key})
		if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid merchant key" {
			t.Errorf("%s: %d %s, want 400 invalid merchant key", name, res.Status, res.Raw)
		}
	}
	res := ana.Post("/me/finance/bill-suggestions/dismissals", map[string]any{"merchantKey": "NETFLIX", "extra": 1})
	apitest.ExpectStatus(t, res, http.StatusBadRequest)
}

func TestAnAcceptedSuggestionIsPaidByTheBankOnTheNextCharge(t *testing.T) {
	t.Parallel()
	app, ana, _ := startSuggest(t)
	monthly(t, app, "ana@example.com", "NETFLIX.COM", 3990)
	s := suggestions(t, ana)[0]
	newBill(t, ana, s.Name, s.AmountCents, s.DueDay)
	if got := suggestions(t, ana); len(got) != 0 {
		t.Fatalf("accepted suggestion still offered: %+v", got)
	}

	app.Clock.Set(time.Date(2026, time.December, 9, 12, 0, 0, 0, time.UTC))
	addCharge(t, app, "ana@example.com", "NETFLIX.COM", 3990, "2026-12-08")
	app.RunFinanceSync(t)
	if got := paidBy(t, ana, "2026-12"); got != "bank" {
		t.Errorf("paidBy = %q, want bank", got)
	}
}
