package finance_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// sourceDays returns the id of the User's Source of a kind, and its closeDay and dueDay as GET /me/finance shows them.
func sourceDays(t *testing.T, c *apitest.Client, kind string) (id string, closeDay, dueDay any) {
	t.Helper()
	for _, s := range c.Get("/me/finance").Body["sources"].([]any) {
		if m := s.(map[string]any); m["kind"] == kind {
			closeDay, ok1 := m["closeDay"]
			dueDay, ok2 := m["dueDay"]
			if !ok1 || !ok2 {
				t.Fatalf("source %v lacks closeDay or dueDay", m)
			}
			return m["id"].(string), closeDay, dueDay
		}
	}
	t.Fatalf("no %s source", kind)
	return
}

func putBillDays(c *apitest.Client, id string, body any) apitest.Response {
	return c.Put("/me/finance/sources/"+id+"/bill-days", body)
}

func clearCardDays(t *testing.T, app *apitest.App) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_sources SET bill_close_day = NULL, bill_due_day = NULL`); err != nil {
		t.Fatal(err)
	}
}

func TestPutBillDays(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com", "bob@example.com"})
	ana, bob := users["ana@example.com"], users["bob@example.com"]
	cardID, c0, d0 := sourceDays(t, ana, "credit_card")
	if c0 != 7.0 || d0 != 12.0 {
		t.Fatalf("days after connecting = %v, %v, want Pluggy's 7 and 12", c0, d0)
	}
	checkingID, closeDay, dueDay := sourceDays(t, ana, "checking")
	if closeDay != nil || dueDay != nil {
		t.Errorf("checking days = %v, %v, want null", closeDay, dueDay)
	}
	bobCardID, _, _ := sourceDays(t, bob, "credit_card")

	for _, tc := range []struct {
		name         string
		body         any
		status       int
		fields       map[string]any // expected "fields" of a 400 from the Bill-form shape
		closeD, dueD any            // days shown after the call
	}{
		{"both set", map[string]any{"closeDay": 7, "dueDay": 12}, 204, nil, 7.0, 12.0},
		{"lowest day", map[string]any{"closeDay": 1, "dueDay": 1}, 204, nil, 1.0, 1.0},
		{"highest day", map[string]any{"closeDay": 31, "dueDay": 31}, 204, nil, 31.0, 31.0},
		{"closing after due", map[string]any{"closeDay": 28, "dueDay": 5}, 204, nil, 28.0, 5.0},
		{"both null clears", map[string]any{"closeDay": nil, "dueDay": nil}, 204, nil, nil, nil},
		{"empty object clears", map[string]any{}, 204, nil, nil, nil},
		{"only closeDay", map[string]any{"closeDay": 7, "dueDay": nil}, 400, map[string]any{"dueDay": "required"}, 3.0, 10.0},
		{"only dueDay", map[string]any{"closeDay": nil, "dueDay": 12}, 400, map[string]any{"closeDay": "required"}, 3.0, 10.0},
		{"only closeDay, key absent", map[string]any{"closeDay": 7}, 400, map[string]any{"dueDay": "required"}, 3.0, 10.0},
		{"closeDay zero", map[string]any{"closeDay": 0, "dueDay": 12}, 400, map[string]any{"closeDay": "invalid"}, 3.0, 10.0},
		{"dueDay 32", map[string]any{"closeDay": 7, "dueDay": 32}, 400, map[string]any{"dueDay": "invalid"}, 3.0, 10.0},
		{"closeDay negative", map[string]any{"closeDay": -1, "dueDay": 12}, 400, map[string]any{"closeDay": "invalid"}, 3.0, 10.0},
		{"both invalid", map[string]any{"closeDay": 0, "dueDay": 40}, 400, map[string]any{"closeDay": "invalid", "dueDay": "invalid"}, 3.0, 10.0},
		{"fraction", map[string]any{"closeDay": 7.5, "dueDay": 12}, 400, nil, 3.0, 10.0},
		{"string", map[string]any{"closeDay": "7", "dueDay": 12}, 400, nil, 3.0, 10.0},
		{"extra key", map[string]any{"closeDay": 7, "dueDay": 12, "x": 1}, 400, nil, 3.0, 10.0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			apitest.ExpectStatus(t, putBillDays(ana, cardID, map[string]any{"closeDay": 3, "dueDay": 10}), http.StatusNoContent)
			res := putBillDays(ana, cardID, tc.body)
			if res.Status != tc.status {
				t.Fatalf("PUT = %d %s, want %d", res.Status, res.Raw, tc.status)
			}
			if tc.status == 400 && tc.fields != nil {
				if res.Body["error"] != "invalid bill days" {
					t.Errorf("error = %v, want invalid bill days", res.Body["error"])
				}
				got, _ := res.Body["fields"].(map[string]any)
				if len(got) != len(tc.fields) {
					t.Errorf("fields = %v, want %v", got, tc.fields)
				}
				for k, v := range tc.fields {
					if got[k] != v {
						t.Errorf("fields = %v, want %v", got, tc.fields)
					}
				}
			}
			if _, c, d := sourceDays(t, ana, "credit_card"); c != tc.closeD || d != tc.dueD {
				t.Errorf("days after = %v, %v, want %v, %v", c, d, tc.closeD, tc.dueD)
			}
		})
	}

	t.Run("malformed id", func(t *testing.T) {
		apitest.ExpectStatus(t, putBillDays(ana, "not-an-id", map[string]any{"closeDay": 7, "dueDay": 12}), http.StatusNotFound)
	})
	t.Run("unknown id", func(t *testing.T) {
		apitest.ExpectStatus(t, putBillDays(ana, "00000000-0000-0000-0000-000000000000", map[string]any{"closeDay": 7, "dueDay": 12}), http.StatusNotFound)
	})
	t.Run("checking Source", func(t *testing.T) {
		apitest.ExpectStatus(t, putBillDays(ana, checkingID, map[string]any{"closeDay": 7, "dueDay": 12}), http.StatusNotFound)
		if _, c, d := sourceDays(t, ana, "checking"); c != nil || d != nil {
			t.Errorf("checking days = %v, %v, want null", c, d)
		}
	})
	t.Run("another User's card", func(t *testing.T) {
		apitest.ExpectStatus(t, putBillDays(ana, bobCardID, map[string]any{"closeDay": 1, "dueDay": 2}), http.StatusNotFound)
		if _, c, d := sourceDays(t, bob, "credit_card"); c != 7.0 || d != 12.0 {
			t.Errorf("bob's days = %v, %v, want 7 and 12 unchanged", c, d)
		}
	})
	t.Run("no sign-in", func(t *testing.T) {
		apitest.ExpectStatus(t, app.Put("/me/finance/sources/"+cardID+"/bill-days", map[string]any{}), http.StatusUnauthorized)
	})
}

// cardsFrom reads the card lines of the first month of the commitments outlook.
func cardsFrom(t *testing.T, c *apitest.Client) []outlookCard {
	t.Helper()
	b, _ := readOutlook(t, c)
	return b.Months[0].Cards
}

// Typing the days on a card that has none moves its charges to their bill's month.
func TestTypedBillDaysMoveCharges(t *testing.T) {
	t.Parallel()
	app, users := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	ana := users["ana@example.com"]
	clearCardDays(t, app)
	insertTxn(t, app, "feb-20", "2028-02-20", -4000, "pets") // closes Feb 7 -> Mar 7: next bill when typed

	if spent, _, _ := readMonth(t, ana, "2028-02"); spent != 4000 {
		t.Fatalf("february spent %d before the days, want 4000 on its purchase date", spent)
	}
	if cards := cardsFrom(t, ana); len(cards) != 1 || cards[0].BillDaysKnown {
		t.Errorf("billDaysKnown before typing = %+v, want false", cards)
	}
	id, _, _ := sourceDays(t, ana, "credit_card")
	apitest.ExpectStatus(t, putBillDays(ana, id, map[string]any{"closeDay": 7, "dueDay": 12}), http.StatusNoContent)

	if spent, _, _ := readMonth(t, ana, "2028-02"); spent != 0 {
		t.Errorf("february spent %d after the days, want 0", spent)
	}
	if cards := cardsFrom(t, ana); len(cards) != 1 || !cards[0].BillDaysKnown {
		t.Errorf("billDaysKnown after typing = %+v, want true", cards)
	}
	if spent, _, _ := readMonth(t, ana, "2028-03"); spent != 4000 {
		t.Errorf("march spent %d after the days, want 4000 on the bill due 12 March", spent)
	}
}
