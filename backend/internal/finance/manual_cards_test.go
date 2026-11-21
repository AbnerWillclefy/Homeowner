package finance_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// The default fake clock is 2026-03-04, so the typed months run 2026-03 to 2027-02.
func manualLines(t *testing.T, c *apitest.Client, id string) []outlookCard {
	t.Helper()
	res := c.Get("/me/finance/commitments?from=2026-03")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var out []outlookCard
	for _, m := range decodeOutlook(t, res.Raw).Months {
		var found []outlookCard
		for _, l := range m.Cards {
			if l.SourceID == id {
				found = append(found, l)
			}
		}
		if len(found) != 1 {
			t.Fatalf("month %s has %d lines for the card, want 1", m.Month, len(found))
		}
		out = append(out, found[0])
	}
	return out
}

func TestAManualCardsBillCarriesForwardTheLatestTypedMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	res := ana.Post("/me/finance/manual-cards", map[string]any{"name": " Fatura Naiara ", "dueDay": 31, "bills": map[string]any{"2026-03": 119000, "2026-05": 24800}})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	id := res.Body["id"].(string)
	if res.Body["name"] != "Fatura Naiara" || res.Body["dueDay"] != float64(31) || res.Body["pixRecipient"] != nil {
		t.Errorf("created = %s", res.Raw)
	}
	lines := manualLines(t, ana, id)
	if len(lines) != 12 {
		t.Fatalf("months = %d, want 12", len(lines))
	}
	for i, l := range lines {
		want := int64(119000)
		if i >= 2 {
			want = 24800
		}
		if l.AmountCents != want || !l.Manual || l.FromBank || !l.BillDaysKnown || l.ClosesOn != nil || l.Name != "Fatura Naiara" {
			t.Errorf("month %d line = %+v, want a manual line of %d", i, l, want)
		}
	}
	if l := lines[0]; l.DueOn == nil || *l.DueOn != "2026-03-31" {
		t.Errorf("due = %v, want 2026-03-31", l.DueOn)
	}
	if l := lines[11]; l.DueOn == nil || *l.DueOn != "2027-02-28" {
		t.Errorf("due = %v, want the clamped 2027-02-28", l.DueOn)
	}
}

func TestAManualCardWithNoTypedValueCountsZeroInEveryMonth(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	res := ana.Post("/me/finance/manual-cards", map[string]any{"name": "Vazio", "dueDay": 1})
	apitest.ExpectStatus(t, res, http.StatusCreated)
	lines := manualLines(t, ana, res.Body["id"].(string))
	for i, l := range lines {
		if l.AmountCents != 0 {
			t.Errorf("month %d = %d, want 0", i, l.AmountCents)
		}
	}
	if len(lines) != 12 {
		t.Errorf("months = %d, want 12", len(lines))
	}
}

func TestManualCardsAreListedUpdatedAndDeleted(t *testing.T) {
	t.Parallel()
	_, ana, bia := twoUsers(t)
	if res := ana.Get("/me/finance/manual-cards"); res.Status != http.StatusOK || !strings.Contains(string(res.Raw), `"cards":[]`) {
		t.Errorf("empty list = %d %s, want cards []", res.Status, res.Raw)
	}
	b := ana.Post("/me/finance/manual-cards", map[string]any{"name": "B card", "dueDay": 5})
	a := ana.Post("/me/finance/manual-cards", map[string]any{"name": "A card", "dueDay": 6, "pixRecipient": "Maria Souza", "bills": map[string]any{"2026-04": 500}})
	list := ana.Get("/me/finance/manual-cards")
	var got struct {
		Cards []struct {
			ID, Name     string
			DueDay       int
			PixRecipient *string
			Bills        map[string]int64
		}
	}
	if err := decodeInto(list.Raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Cards) != 2 || got.Cards[0].Name != "A card" || got.Cards[1].Name != "B card" || got.Cards[0].PixRecipient == nil || *got.Cards[0].PixRecipient != "Maria Souza" ||
		got.Cards[0].Bills["2026-04"] != 500 || got.Cards[1].Bills == nil || len(got.Cards[1].Bills) != 0 {
		t.Errorf("list = %s, want A then B with bills as an object", list.Raw)
	}
	aid, bid := a.Body["id"].(string), b.Body["id"].(string)

	// null deletes a month, an absent month stays, a cleared recipient is null.
	up := ana.Put("/me/finance/manual-cards/"+aid, map[string]any{"name": "A2", "dueDay": 7, "pixRecipient": "", "bills": map[string]any{"2026-05": 700}})
	apitest.ExpectStatus(t, up, http.StatusOK)
	if up.Body["name"] != "A2" || up.Body["pixRecipient"] != nil || fmt.Sprint(up.Body["bills"]) != "map[2026-04:500 2026-05:700]" {
		t.Errorf("updated = %s", up.Raw)
	}
	up = ana.Put("/me/finance/manual-cards/"+aid, map[string]any{"name": "A2", "dueDay": 7, "bills": map[string]any{"2026-04": nil}})
	if fmt.Sprint(up.Body["bills"]) != "map[2026-05:700]" {
		t.Errorf("after null = %s, want the month deleted", up.Raw)
	}

	apitest.ExpectStatus(t, bia.Put("/me/finance/manual-cards/"+aid, map[string]any{"name": "x", "dueDay": 1}), http.StatusNotFound)
	apitest.ExpectStatus(t, bia.Delete("/me/finance/manual-cards/"+aid), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Put("/me/finance/manual-cards/not-an-id", map[string]any{"name": "x", "dueDay": 1}), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/manual-cards/"+aid), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/manual-cards/"+aid), http.StatusNotFound)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/manual-cards/"+bid), http.StatusNoContent)
}

func TestManualCardValidation(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	ok := func(over map[string]any) map[string]any {
		b := map[string]any{"name": "Card", "dueDay": 10}
		for k, v := range over {
			b[k] = v
		}
		return b
	}
	max := int64(1_000_000_000_000)
	for name, c := range map[string]struct {
		body   map[string]any
		status int
		field  string
		code   string
	}{
		"day 1":                      {ok(map[string]any{"dueDay": 1}), 201, "", ""},
		"day 31":                     {ok(map[string]any{"dueDay": 31}), 201, "", ""},
		"day 0":                      {ok(map[string]any{"dueDay": 0}), 400, "dueDay", "invalid"},
		"day 32":                     {ok(map[string]any{"dueDay": 32}), 400, "dueDay", "invalid"},
		"no name":                    {ok(map[string]any{"name": " "}), 400, "name", "required"},
		"a long name":                {ok(map[string]any{"name": strings.Repeat("a", 61)}), 400, "name", "too_long"},
		"a long recipient":           {ok(map[string]any{"pixRecipient": strings.Repeat("a", 61)}), 400, "pixRecipient", "too_long"},
		"a control in the recipient": {ok(map[string]any{"pixRecipient": "a\nb"}), 400, "pixRecipient", "invalid"},
		"the current month":          {ok(map[string]any{"bills": map[string]any{"2026-03": 0}}), 201, "", ""},
		"the last month":             {ok(map[string]any{"bills": map[string]any{"2027-02": max}}), 201, "", ""},
		"the month before":           {ok(map[string]any{"bills": map[string]any{"2026-02": 1}}), 400, "bills", "invalid_month"},
		"a month past the last":      {ok(map[string]any{"bills": map[string]any{"2027-03": 1}}), 400, "bills", "invalid_month"},
		"a malformed month":          {ok(map[string]any{"bills": map[string]any{"2026-13": 1}}), 400, "bills", "invalid_month"},
		"a month with a day":         {ok(map[string]any{"bills": map[string]any{"2026-03-01": 1}}), 400, "bills", "invalid_month"},
		"a negative total":           {ok(map[string]any{"bills": map[string]any{"2026-03": -1}}), 400, "bills", "invalid"},
		"a total over the ceiling":   {ok(map[string]any{"bills": map[string]any{"2026-03": max + 1}}), 400, "bills", "invalid"},
		"an unknown field":           {ok(map[string]any{"color": "red"}), 400, "", ""},
		"a text total":               {ok(map[string]any{"bills": map[string]any{"2026-03": "1"}}), 400, "", ""},
	} {
		res := ana.Post("/me/finance/manual-cards", c.body)
		if res.Status != c.status {
			t.Errorf("%s: status = %d %s, want %d", name, res.Status, res.Raw, c.status)
			continue
		}
		if c.field != "" {
			if f, _ := res.Body["fields"].(map[string]any); f[c.field] != c.code {
				t.Errorf("%s: fields = %s, want %s = %s", name, res.Raw, c.field, c.code)
			}
		}
	}
	// A failed update leaves the card as it was.
	made := ana.Post("/me/finance/manual-cards", ok(map[string]any{"bills": map[string]any{"2026-03": 5}}))
	bad := ana.Put("/me/finance/manual-cards/"+made.Body["id"].(string), ok(map[string]any{"name": "Changed", "bills": map[string]any{"2026-03": 9, "2026-02": 1}}))
	apitest.ExpectStatus(t, bad, http.StatusBadRequest)
	if l := manualLines(t, ana, made.Body["id"].(string)); l[0].AmountCents != 5 {
		t.Errorf("month 0 after a refused update = %d, want 5", l[0].AmountCents)
	}
}

func TestDeletingTheFixedBillLeavesOnlyTheManualCard(t *testing.T) {
	t.Parallel()
	_, ana, _ := twoUsers(t)
	bill := newBill(t, ana, "Fatura Naiara", 110900, 10)
	card := ana.Post("/me/finance/manual-cards", map[string]any{"name": "Nubank Naiara", "dueDay": 10, "bills": map[string]any{"2026-03": 119000}})
	id := card.Body["id"].(string)
	read := func() (total int64, other int, lines int) {
		m := decodeOutlook(t, ana.Get("/me/finance/commitments?from=2026-03").Raw).Months[0]
		for _, l := range m.Cards {
			if l.SourceID == id {
				lines++
			}
		}
		return m.TotalCents, len(m.OtherBills), lines
	}
	before, other, lines := read()
	if other != 1 || lines != 1 {
		t.Fatalf("before: other bills %d, card lines %d, want 1 and 1", other, lines)
	}
	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+bill), http.StatusNoContent)
	after, other, lines := read()
	if other != 0 || lines != 1 || before-after != 110900 {
		t.Errorf("after: other bills %d, card lines %d, total %d -> %d, want 0, 1 and a drop of 110900", other, lines, before, after)
	}
}

func decodeInto(raw []byte, v any) error { return json.Unmarshal(raw, v) }

func decodeOutlook(t *testing.T, raw []byte) outlookBody {
	t.Helper()
	var b outlookBody
	if err := json.Unmarshal(raw, &b); err != nil {
		t.Fatal(err)
	}
	return b
}
