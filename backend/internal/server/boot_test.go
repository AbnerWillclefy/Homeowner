package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

type bootBody struct {
	Sections map[string]struct {
		Status int             `json:"status"`
		Body   json.RawMessage `json:"body"`
	} `json:"sections"`
}

func getBoot(t *testing.T, c *apitest.Client, query string) bootBody {
	t.Helper()
	res := c.Get("/boot" + query)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /boot%s = %d %s", query, res.Status, res.Raw)
	}
	var b bootBody
	if err := json.Unmarshal(res.Raw, &b); err != nil {
		t.Fatalf("decode boot: %v", err)
	}
	return b
}

func TestBootSectionsEqualTheirOwnEndpoints(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	c := apitest.HomeWithResident(t, app, "ana@example.com")
	apitest.CreateChore(t, c, apitest.ValidChore())
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	b := getBoot(t, c, "?month=2026-03")
	keys := []string{"/me", "/me/onboarding", "/demands", "/home", "/home/day-plan", "/home/check-in",
		"/home/streak", "/home/residents", "/me/finance", "/me/finance/bills?month=2026-03",
		"/me/finance/commitments?from=2026-03", "/me/finance/savings", "/me/finance/bill-suggestions"}
	if len(b.Sections) != len(keys) {
		t.Errorf("got %d sections, want %d", len(b.Sections), len(keys))
	}
	for _, k := range keys {
		want, got := c.Get(k), b.Sections[k]
		if got.Status != want.Status || !bytes.Equal(bytes.TrimSpace(got.Body), bytes.TrimSpace(want.Raw)) {
			t.Errorf("%s: boot %d %s, endpoint %d %s", k, got.Status, got.Body, want.Status, want.Raw)
		}
	}
}

func TestBootGates(t *testing.T) {
	t.Parallel()
	financeKeys := []string{"/me/finance", "/me/finance/bills?month=2026-03", "/me/finance/commitments?from=2026-03",
		"/me/finance/savings", "/me/finance/bill-suggestions"}
	residentKeys := []string{"/home", "/home/day-plan", "/home/check-in", "/home/streak", "/home/residents"}
	tests := []struct {
		name    string
		opts    []apitest.Option
		home    bool
		query   string
		absent  []string
		status  map[string]int
		errBody map[string]string
	}{
		{name: "off the allowlist leaves finance out", opts: []apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), "bob@example.com")},
			home: true, query: "?month=2026-03", absent: financeKeys},
		{name: "empty allowlist leaves finance out", home: true, query: "?month=2026-03", absent: financeKeys},
		{name: "allowed with no key is 503", opts: []apitest.Option{apitest.WithFinance(nil, "ana@example.com")},
			home: true, query: "?month=2026-03", status: map[string]int{
				"/me/finance": 503, "/me/finance/bills?month=2026-03": 503, "/me/finance/commitments?from=2026-03": 503,
				"/me/finance/savings": 503, "/me/finance/bill-suggestions": 503}},
		{name: "no month leaves bills and commitments out", opts: []apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com")},
			home: true, absent: []string{"/me/finance/bills?month=", "/me/finance/commitments?from="},
			status: map[string]int{"/me/finance": 200, "/me/finance/savings": 200}},
		{name: "bad month is 400 on those two", opts: []apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com")},
			home: true, query: "?month=nope", status: map[string]int{
				"/me/finance/bills?month=nope": 400, "/me/finance/commitments?from=nope": 400, "/me/finance": 200}},
		{name: "no home", opts: []apitest.Option{apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com")},
			query: "?month=2026-03", status: map[string]int{"/me": 200, "/me/onboarding": 200, "/demands": 200,
				"/home": 404, "/home/day-plan": 404, "/home/check-in": 404, "/home/streak": 404, "/home/residents": 404},
			errBody: map[string]string{"/home": `{"error":"no home"}`}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			app := apitest.Start(t, tt.opts...)
			c := app.SignInAs("ana@example.com")
			if tt.home {
				c = apitest.HomeWithResident(t, app, "ana@example.com")
			}
			b := getBoot(t, c, tt.query)
			for _, prefix := range tt.absent {
				for k := range b.Sections {
					if strings.HasPrefix(k, prefix) {
						t.Errorf("%s should be left out", k)
					}
				}
			}
			for k, want := range tt.status {
				if got := b.Sections[k].Status; got != want {
					t.Errorf("%s = %d, want %d", k, got, want)
				}
			}
			for k, want := range tt.errBody {
				if got := string(bytes.TrimSpace(b.Sections[k].Body)); got != want {
					t.Errorf("%s body = %s, want %s", k, got, want)
				}
			}
			if !tt.home {
				for _, k := range residentKeys {
					if b.Sections[k].Status != 404 {
						t.Errorf("%s = %d, want 404", k, b.Sections[k].Status)
					}
				}
			}
		})
	}
}

func TestBootNeedsASignedInUser(t *testing.T) {
	t.Parallel()
	if res := apitest.Start(t).Get("/boot"); res.Status != http.StatusUnauthorized {
		t.Errorf("no token = %d, want 401", res.Status)
	}
	if res := apitest.Start(t, apitest.WithoutAuth()).Get("/boot"); res.Status != http.StatusServiceUnavailable {
		t.Errorf("without auth = %d, want 503", res.Status)
	}
}
