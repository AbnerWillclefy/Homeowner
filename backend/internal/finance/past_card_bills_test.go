package finance_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

// Today is 2026-11-08. The bills close on the 1st of each month and are due on the 10th.
func TestPastCardBills(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bia@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	card := sourceOf(t, ana, "credit_card")["id"].(string)
	checking := sourceOf(t, ana, "checking")["id"].(string)
	biasCard := sourceOf(t, users["bia@example.com"], "credit_card")["id"].(string)
	exec(t, app, `DELETE FROM finance_card_bills`)
	// seed adds the bills closed on the 1st of the n months up to October, 100.00 more each month, plus the open one closing 2026-11-20.
	seed := func(n int) {
		exec(t, app, `INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
			SELECT user_id, id, 'm' || i, date '2026-10-01' - make_interval(months => i), date '2026-10-10' - make_interval(months => i), 100000 + 10000 * (11 - i)
			FROM finance_sources, generate_series(0, $1::int - 1) i WHERE id = $2`, n, card)
	}
	type bill struct {
		ClosesOn, DueOn string
		TotalCents      int64
	}
	for _, tc := range []struct {
		name    string
		seed    func()
		query   string
		status  int
		firstTo string // first closesOn, last closesOn
		count   int
		average any
	}{
		{"no bills", func() {}, "source=" + card, 200, "", 0, nil},
		{"fewer than six", func() { seed(2) }, "source=" + card, 200, "2026-09-01", 2, float64(205000)},
		{"more than six, the latest six oldest first", func() { seed(8) }, "source=" + card, 200, "2026-05-01", 6, float64(185000)},
		{"the open bill is left out", func() {
			seed(1)
			exec(t, app, `INSERT INTO finance_card_bills (user_id, source_id, provider_id, closes_on, due_on, total_cents)
				SELECT user_id, id, 'open', '2026-11-20', '2026-11-30', 999999 FROM finance_sources WHERE id = $1`, card)
		}, "source=" + card, 200, "2026-10-01", 1, float64(210000)},
		{"months narrows it", func() { seed(8) }, "source=" + card + "&months=2", 200, "2026-09-01", 2, float64(205000)},
		{"months 12", func() { seed(8) }, "source=" + card + "&months=12", 200, "2026-03-01", 8, float64(175000)},
		{"months 0", func() {}, "source=" + card + "&months=0", 400, "", 0, nil},
		{"months 13", func() {}, "source=" + card + "&months=13", 400, "", 0, nil},
		{"months abc", func() {}, "source=" + card + "&months=abc", 400, "", 0, nil},
		{"no source", func() {}, "", 400, "", 0, nil},
		{"malformed source", func() {}, "source=nope", 400, "", 0, nil},
		{"unknown source", func() {}, "source=00000000-0000-4000-8000-000000000001", 404, "", 0, nil},
		{"another User's source", func() {}, "source=" + biasCard, 404, "", 0, nil},
		{"a checking source", func() {}, "source=" + checking, 404, "", 0, nil},
	} {
		exec(t, app, `DELETE FROM finance_card_bills`)
		tc.seed()
		res := ana.Get("/me/finance/card-bills?" + tc.query)
		if res.Status != tc.status {
			t.Errorf("%s: status = %d %s, want %d", tc.name, res.Status, res.Raw, tc.status)
			continue
		}
		if tc.status != http.StatusOK {
			continue
		}
		var b struct {
			SourceID     string
			Bills        []bill
			AverageCents any
		}
		if err := json.Unmarshal(res.Raw, &b); err != nil {
			t.Fatal(err)
		}
		if b.SourceID != card || len(b.Bills) != tc.count || b.AverageCents != tc.average || (tc.count > 0 && b.Bills[0].ClosesOn != tc.firstTo) {
			t.Errorf("%s: body = %s, want %d bills from %q averaging %v", tc.name, res.Raw, tc.count, tc.firstTo, tc.average)
		}
		if tc.name == "no bills" && fmt.Sprint(res.Body["bills"]) != "[]" {
			t.Errorf("no bills: bills = %v, want [] not null", res.Body["bills"])
		}
	}
}
