package finance_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func day(m time.Month, d int) time.Time { return time.Date(2026, m, d, 0, 0, 0, 0, time.UTC) }

// history reads the User's stored values for one Investment over a wide range.
func history(t *testing.T, app *apitest.App, email, id string) []finance.Point[int64] {
	t.Helper()
	got, err := finance.NewStore(app.DB).InvestmentValues(context.Background(), userID(t, app, email), day(time.January, 1), day(time.December, 31))
	if err != nil {
		t.Fatal(err)
	}
	return got[id]
}

func TestCreatingAnInvestmentStoresTodaysValue(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	app.Clock.Set(day(time.November, 8).Add(15 * time.Hour))
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	if got := history(t, app, "ana@example.com", id); len(got) != 1 || got[0] != (finance.Point[int64]{Day: day(time.November, 8), Value: 100000}) {
		t.Errorf("history = %v", got)
	}
}

func TestChangingTheValueTwiceInADayKeepsTheLaterOne(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	app.Clock.Set(day(time.November, 8).Add(15 * time.Hour))
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("CDB", 150000, "reserve")), http.StatusOK)
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("CDB", 0, "reserve")), http.StatusOK)
	if got := history(t, app, "ana@example.com", id); len(got) != 1 || got[0].Value != 0 {
		t.Errorf("history = %v, want one row with 0", got)
	}
	app.Clock.Set(day(time.November, 9).Add(15 * time.Hour))
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("CDB", 200000, "reserve")), http.StatusOK)
	got := history(t, app, "ana@example.com", id)
	if len(got) != 2 || got[0].Value != 0 || got[1] != (finance.Point[int64]{Day: day(time.November, 9), Value: 200000}) {
		t.Errorf("history = %v, want day 8 = 0 then day 9 = 200000", got)
	}
}

func TestTheHistoryDayIsTheSaoPauloDay(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	app.Clock.Set(time.Date(2026, time.November, 9, 2, 0, 0, 0, time.UTC)) // 23:00 on the 8th in São Paulo
	id := newInvestment(t, ana, "CDB", 1, "goals")
	if got := history(t, app, "ana@example.com", id); len(got) != 1 || !got[0].Day.Equal(day(time.November, 8)) {
		t.Errorf("history = %v, want day 8", got)
	}
}

func TestAnUpdateOfAnotherUsersInvestmentWritesNoHistory(t *testing.T) {
	t.Parallel()
	app, ana, bia := twoUsers(t)
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	apitest.ExpectStatus(t, bia.Put("/me/finance/investments/"+id, investmentBody("x", 5, "goals")), http.StatusNotFound)
	if got := history(t, app, "ana@example.com", id); len(got) != 1 || got[0].Value != 100000 {
		t.Errorf("history = %v", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_investment_values WHERE user_id = $1`, userID(t, app, "bia@example.com")); n != 0 {
		t.Errorf("bia has %d history rows", n)
	}
}

func TestTheReadIncludesTheLastValueBeforeTheRangeAndNeverAnotherUsers(t *testing.T) {
	t.Parallel()
	app, ana, bia := twoUsers(t)
	app.Clock.Set(day(time.November, 8).Add(15 * time.Hour))
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	newInvestment(t, bia, "Other", 7, "reserve")
	app.Clock.Set(day(time.November, 12).Add(15 * time.Hour))
	apitest.ExpectStatus(t, ana.Put("/me/finance/investments/"+id, investmentBody("CDB", 300000, "reserve")), http.StatusOK)
	got, err := finance.NewStore(app.DB).InvestmentValues(context.Background(), userID(t, app, "ana@example.com"), day(time.November, 10), day(time.November, 14))
	if err != nil {
		t.Fatal(err)
	}
	want := []finance.Point[int64]{{Day: day(time.November, 8), Value: 100000}, {Day: day(time.November, 12), Value: 300000}}
	if len(got) != 1 || len(got[id]) != 2 || got[id][0] != want[0] || got[id][1] != want[1] {
		t.Errorf("read = %v, want only %s: %v", got, id, want)
	}
}

func TestDeletingAnInvestmentRemovesItsHistory(t *testing.T) {
	t.Parallel()
	app, ana, _ := twoUsers(t)
	id := newInvestment(t, ana, "CDB", 100000, "reserve")
	other := newInvestment(t, ana, "LCI", 5, "goals")
	apitest.ExpectStatus(t, ana.Delete("/me/finance/investments/"+id), http.StatusNoContent)
	if n := scalar(t, app, `SELECT count(*) FROM finance_investment_values WHERE investment_id = $1`, id); n != 0 {
		t.Errorf("%d history rows left", n)
	}
	if got := history(t, app, "ana@example.com", other); len(got) != 1 {
		t.Errorf("the other Investment's history = %v", got)
	}
}
