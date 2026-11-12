package finance_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testP256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
	testAuth   = "tBHItJI5svbpez7KI4CCXg"
	deviceURL  = "https://push.example.com/send/a"
)

// remindersApp starts an allowlisted User with a device and the clock at at.
// Reminders need no Pluggy, so none is started.
func remindersApp(t *testing.T, at time.Time) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"), apitest.WithPush("pub"))
	app.Clock.Set(at)
	ana := app.SignInAs("ana@example.com")
	subscribeDevice(t, ana)
	return app, ana
}

func subscribeDevice(t *testing.T, c *apitest.Client) {
	t.Helper()
	r := c.Put("/push/subscription", map[string]any{
		"endpoint": deviceURL,
		"keys":     map[string]string{"p256dh": testP256dh, "auth": testAuth},
	})
	if r.Status >= 300 {
		t.Fatalf("PUT /push/subscription = %d %s", r.Status, r.Raw)
	}
}

func addBill(t *testing.T, c *apitest.Client, name string, dueDay int) string {
	t.Helper()
	r := c.Post("/me/finance/bills", map[string]any{"name": name, "expectedCents": 123456, "dueDay": dueDay})
	apitest.ExpectStatus(t, r, http.StatusCreated)
	return r.Body["id"].(string)
}

func sentKinds(app *apitest.App) (kinds []string) {
	for _, s := range app.Push.Sent() {
		kinds = append(kinds, s.Payload.Kind)
	}
	return kinds
}

// runKinds runs the reminders and returns the Kind of every push sent so far.
func runKinds(t *testing.T, app *apitest.App) []string {
	t.Helper()
	app.RunFinanceReminders(t)
	return sentKinds(app)
}

func oneKind(t *testing.T, got []string, want string) {
	t.Helper()
	if len(got) != 1 || got[0] != want {
		t.Errorf("sent kinds = %v, want [%s]", got, want)
	}
}

// afterFixtures, 2026-11-08 12:00 UTC, is Sunday 09:00 in São Paulo: the first
// hour reminders may be sent.
func TestReminderKindsFollowTheDueDate(t *testing.T) {
	t.Parallel()
	for name, c := range map[string]struct {
		dueDay int
		want   string
	}{
		"today":    {8, "bill_due_today"},
		"tomorrow": {9, "bill_due_soon"},
		"overdue":  {3, "bill_overdue"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			app, ana := remindersApp(t, afterFixtures)
			addBill(t, ana, "Aluguel", c.dueDay)
			oneKind(t, runKinds(t, app), c.want)
			p := app.Push.Sent()[0].Payload
			if p.URL != "/finances" || p.Title == "" || p.Body == "" {
				t.Errorf("payload = %+v", p)
			}
			if text := p.Title + p.Body; strings.Contains(text, "Aluguel") || strings.Contains(text, "1234") {
				t.Errorf("payload names the Bill or the amount: %+v", p)
			}
		})
	}
}

func TestBillRemindersSkipRevenueDevices(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	if _, err := app.DB.Exec(context.Background(), `UPDATE push_subscriptions SET app = 'revenue'`); err != nil {
		t.Fatal(err)
	}
	addBill(t, ana, "Aluguel", 8)
	if got := runKinds(t, app); len(got) != 0 {
		t.Errorf("sent %v to a Revenue device, want nothing", got)
	}
}

func TestABillDueLaterSendsNothing(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 20)
	if got := runKinds(t, app); len(got) != 0 {
		t.Errorf("sent %v, want nothing", got)
	}
}

func TestAReminderIsSentOncePerBillMonthAndKind(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	runKinds(t, app)
	oneKind(t, runKinds(t, app), "bill_due_soon")
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_reminders WHERE outcome = 'delivered'`); n != 1 {
		t.Errorf("delivered ledger rows = %d, want 1", n)
	}
}

func TestBillsSharingANoticeSendOnePush(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	addBill(t, ana, "Luz", 9)
	oneKind(t, runKinds(t, app), "bill_due_soon")
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_reminders WHERE outcome = 'delivered'`); n != 2 {
		t.Errorf("delivered ledger rows = %d, want 2", n)
	}
}

func TestAPaidBillGetsNoReminder(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	id := addBill(t, ana, "Aluguel", 9)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	if got := runKinds(t, app); len(got) != 0 {
		t.Errorf("sent %v, want nothing", got)
	}
}

func TestAnUndonePaymentIsRemindedAgain(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	id := addBill(t, ana, "Aluguel", 9)
	apitest.ExpectStatus(t, ana.Put("/me/finance/bills/"+id+"/payments/2026-11", nil), http.StatusNoContent)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/bills/"+id+"/payments/2026-11"), http.StatusNoContent)
	oneKind(t, runKinds(t, app), "bill_due_soon")
}

func TestNoDeviceMeansNoReminderAndNoClaim(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM push_subscriptions`); err != nil {
		t.Fatal(err)
	}
	if got := runKinds(t, app); len(got) != 0 {
		t.Errorf("sent %v, want nothing", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_reminders`); n != 0 {
		t.Errorf("ledger rows = %d, want 0", n)
	}
	subscribeDevice(t, ana)
	oneKind(t, runKinds(t, app), "bill_due_soon")
}

func TestNoHomeUsesSaoPauloDates(t *testing.T) {
	t.Parallel()
	// 01:00 UTC on the 8th is 22:00 on the 7th in São Paulo: the 8th is tomorrow there.
	app, ana := remindersApp(t, time.Date(2026, 11, 8, 1, 0, 0, 0, time.UTC))
	addBill(t, ana, "Aluguel", 8)
	oneKind(t, runKinds(t, app), "bill_due_soon")
}

func TestAHomeInAnotherZoneUsesItsDate(t *testing.T) {
	t.Parallel()
	// 20:00 UTC on the 8th is 09:00 on the 9th in Auckland, but the 8th in São Paulo.
	app, ana := remindersApp(t, time.Date(2026, 11, 8, 20, 0, 0, 0, time.UTC))
	apitest.ExpectStatus(t, ana.Post("/home", apitest.HomeBody("Pacific/Auckland", "07:00")), http.StatusCreated)
	addBill(t, ana, "Aluguel", 9)
	oneKind(t, runKinds(t, app), "bill_due_today")
}

func TestDueDay31FallsOnTheLastDayOfAShortMonth(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, time.Date(2026, 11, 29, 12, 0, 0, 0, time.UTC))
	addBill(t, ana, "Aluguel", 31)
	oneKind(t, runKinds(t, app), "bill_due_soon") // November has 30 days
}

func TestNothingIsSentBeforeNineLocal(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures.Add(-time.Minute)) // 08:59 in São Paulo
	addBill(t, ana, "Aluguel", 9)
	if got := runKinds(t, app); len(got) != 0 {
		t.Errorf("sent %v, want nothing", got)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_reminders`); n != 0 {
		t.Errorf("ledger rows = %d, want 0", n)
	}
	app.Clock.Set(afterFixtures)
	oneKind(t, runKinds(t, app), "bill_due_soon")
}

func TestAGoneDeviceIsPrunedAndTheOutcomeRecorded(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	app.Push.AnswerGone(deviceURL)
	runKinds(t, app)
	if n := scalar(t, app, `SELECT count(*) FROM finance_bill_reminders WHERE outcome = 'gone'`); n != 1 {
		t.Errorf("gone ledger rows = %d, want 1", n)
	}
	if n := scalar(t, app, `SELECT count(*) FROM push_subscriptions`); n != 0 {
		t.Errorf("subscriptions = %d, want pruned", n)
	}
}

func TestRemindersRunWhenTheSyncFails(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	// A Syncer over a closed pool cannot find the Items, so its Run errors.
	closed, err := pgxpool.NewWithConfig(context.Background(), app.DB.Config())
	if err != nil {
		t.Fatal(err)
	}
	closed.Close()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	syncer := finance.NewSyncer(finance.NewStore(closed), nil, apitest.FinanceTestKey(), finance.NewAllowlist([]string{"ana@example.com"}), log, 0)
	srv := httptest.NewServer(finance.EventsHandler(syncer, app.FinanceReminders, app.Clock, log))
	t.Cleanup(srv.Close)
	res, err := http.Post(srv.URL+"/events", "application/json", strings.NewReader(`{"source":"aws.events","detail-type":"Scheduled Event"}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("event = %d, want 500", res.StatusCode)
	}
	oneKind(t, sentKinds(app), "bill_due_soon")
}

func TestTheScheduledEventSendsReminders(t *testing.T) {
	t.Parallel()
	app, ana := remindersApp(t, afterFixtures)
	addBill(t, ana, "Aluguel", 9)
	srv := httptest.NewServer(finance.EventsHandler(nil, app.FinanceReminders, app.Clock, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(srv.Close)
	res, err := http.Post(srv.URL+"/events", "application/json", strings.NewReader(`{"source":"aws.events","detail-type":"Scheduled Event"}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("event = %d", res.StatusCode)
	}
	oneKind(t, sentKinds(app), "bill_due_soon")
}
