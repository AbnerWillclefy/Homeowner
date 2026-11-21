package finance_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

// sourceNames returns a Source's id, and the name and bankName GET /me/finance shows for it.
func sourceNames(t *testing.T, c *apitest.Client, kind string) (id, name, bankName string) {
	t.Helper()
	for _, s := range c.Get("/me/finance").Body["sources"].([]any) {
		if m := s.(map[string]any); m["kind"] == kind {
			bank, ok := m["bankName"].(string)
			if !ok {
				t.Fatalf("source %v lacks bankName", m)
			}
			return m["id"].(string), m["name"].(string), bank
		}
	}
	t.Fatalf("no %s source", kind)
	return
}

func putName(c *apitest.Client, id string, body any) apitest.Response {
	return c.Put("/me/finance/sources/"+id+"/name", body)
}

// shownEverywhere checks the card's name in the month's Transactions and in the commitments' card bills.
func shownEverywhere(t *testing.T, c *apitest.Client, cardID, want string) {
	t.Helper()
	_, _, txns := readMonth(t, c, "2026-11")
	seen := false
	for _, x := range txns {
		seen = seen || x.SourceName == want
	}
	if !seen {
		t.Errorf("no transaction shows sourceName %q", want)
	}
	found := false
	for _, m := range c.Get("/me/finance/commitments?from=2026-11").Body["months"].([]any) {
		for _, card := range m.(map[string]any)["cards"].([]any) {
			if cm := card.(map[string]any); cm["sourceId"] == cardID {
				found = true
				if cm["name"] != want {
					t.Errorf("commitments card name = %v, want %q", cm["name"], want)
				}
			}
		}
	}
	if !found {
		t.Error("commitments list no bill for the card")
	}
}

func TestPutSourceName(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	ana, bob := users["ana@example.com"], users["bob@example.com"]
	app.RunFinanceSync(t)
	cardID, _, bank := sourceNames(t, ana, "credit_card")
	bobCardID, _, bobBank := sourceNames(t, bob, "credit_card")

	t.Run("set then clear", func(t *testing.T) {
		apitest.ExpectStatus(t, putName(ana, cardID, map[string]any{"name": "  Nubank "}), http.StatusNoContent)
		if _, name, bankName := sourceNames(t, ana, "credit_card"); name != "Nubank" || bankName != bank {
			t.Errorf("name, bankName = %q, %q, want Nubank, %q", name, bankName, bank)
		}
		shownEverywhere(t, ana, cardID, "Nubank")
		apitest.ExpectStatus(t, putName(ana, cardID, map[string]any{"name": nil}), http.StatusNoContent)
		if _, name, bankName := sourceNames(t, ana, "credit_card"); name != bank || bankName != bank {
			t.Errorf("name, bankName = %q, %q, want both %q", name, bankName, bank)
		}
		shownEverywhere(t, ana, cardID, bank)
	})

	t.Run("answers", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			body   any
			status int
			field  string // expected fields.name of a 400 from the Bill-form shape
		}{
			{"empty", map[string]any{"name": ""}, 400, "required"},
			{"spaces", map[string]any{"name": "   "}, 400, "required"},
			{"61 runes", map[string]any{"name": strings.Repeat("ç", 61)}, 400, "too_long"},
			{"control character", map[string]any{"name": "a\nb"}, 400, "invalid"},
			{"extra key", map[string]any{"name": "x", "y": 1}, 400, ""},
			{"number", map[string]any{"name": 5}, 400, ""},
			{"60 runes", map[string]any{"name": strings.Repeat("ç", 60)}, 204, ""},
			{"1 rune", map[string]any{"name": "N"}, 204, ""},
		} {
			t.Run(tc.name, func(t *testing.T) {
				apitest.ExpectStatus(t, putName(ana, cardID, map[string]any{"name": "Before"}), http.StatusNoContent)
				res := putName(ana, cardID, tc.body)
				if res.Status != tc.status {
					t.Fatalf("PUT = %d %s, want %d", res.Status, res.Raw, tc.status)
				}
				if tc.status != 400 {
					return
				}
				if _, name, _ := sourceNames(t, ana, "credit_card"); name != "Before" {
					t.Errorf("name = %q after a refusal, want Before", name)
				}
				if tc.field != "" {
					fields, _ := res.Body["fields"].(map[string]any)
					if res.Body["error"] != "invalid source name" || fields["name"] != tc.field {
						t.Errorf("answer = %s, want invalid source name with name %s", res.Raw, tc.field)
					}
				}
			})
		}
	})

	t.Run("not found", func(t *testing.T) {
		apitest.ExpectStatus(t, putName(ana, "not-an-id", map[string]any{"name": "x"}), http.StatusNotFound)
		apitest.ExpectStatus(t, putName(ana, "00000000-0000-0000-0000-000000000000", map[string]any{"name": "x"}), http.StatusNotFound)
		apitest.ExpectStatus(t, putName(ana, bobCardID, map[string]any{"name": "Mine"}), http.StatusNotFound)
		if _, name, _ := sourceNames(t, bob, "credit_card"); name != bobBank {
			t.Errorf("bob's name = %q, want %q unchanged", name, bobBank)
		}
	})

	t.Run("no token", func(t *testing.T) {
		apitest.ExpectStatus(t, app.Put("/me/finance/sources/"+cardID+"/name", map[string]any{"name": "x"}), http.StatusUnauthorized)
	})

	t.Run("a sync and a reconnect keep it", func(t *testing.T) {
		apitest.ExpectStatus(t, putName(ana, cardID, map[string]any{"name": "Nubank"}), http.StatusNoContent)
		if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET name = 'stale' WHERE id = $1`, cardID); err != nil {
			t.Fatal(err)
		}
		app.RunFinanceSync(t)
		if _, name, bankName := sourceNames(t, ana, "credit_card"); name != "Nubank" || bankName != "stale" {
			t.Errorf("after sync name, bankName = %q, %q, want Nubank, stale", name, bankName)
		}
		if res := ana.Post("/me/finance/items", map[string]string{"itemId": pluggytest.ItemID}); res.Status != http.StatusOK {
			t.Fatalf("POST items = %d %s", res.Status, res.Raw)
		}
		if _, name, bankName := sourceNames(t, ana, "credit_card"); name != "Nubank" || bankName != bank {
			t.Errorf("after reconnect name, bankName = %q, %q, want Nubank, %q", name, bankName, bank)
		}
	})
}
