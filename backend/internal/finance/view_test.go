package finance_test

import (
	"context"
	"log/slog"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
)

// A view method reads the User id it is given, never the context's: asked for
// Bob with a context that holds no User, it answers with Bob's rows, not Ana's.
func TestViewMethodsReadTheUserIDTheyAreGiven(t *testing.T) {
	t.Parallel()
	app, _ := seedDaily(t)
	var bob string
	if err := app.DB.QueryRow(context.Background(), `SELECT id FROM users WHERE email = 'bob@example.com'`).Scan(&bob); err != nil {
		t.Fatal(err)
	}
	h := finance.NewHandler(finance.NewStore(app.DB), nil, nil, "local", app.Clock, slog.Default())

	daily, err := h.DailyView(context.Background(), bob, "2027-03")
	if err != nil {
		t.Fatal(err)
	}
	if len(daily.Current) != 15 || daily.Current[1] != 9999 {
		t.Errorf("daily current = %v, want Bob's 9999 on day 2 (Ana's is 500)", daily.Current)
	}
	month, err := h.MonthView(context.Background(), bob, "2027-03")
	if err != nil {
		t.Fatal(err)
	}
	if month.SpentCents != 9999 {
		t.Errorf("month spent = %d, want Bob's 9999", month.SpentCents)
	}
}
