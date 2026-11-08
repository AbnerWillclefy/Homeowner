package finance_test

import (
	"bytes"
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

const (
	testClientID = "pluggy-client-id-0123"
	testSecret   = "pluggy-secret-abcdef"
)

func creds() map[string]any {
	return map[string]any{"clientId": testClientID, "clientSecret": testSecret}
}

func TestCredentialsSaveReportAndRemove(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bob@example.com"))
	ana, bob := app.SignInAs("ana@example.com"), app.SignInAs("bob@example.com")

	if res := ana.Put("/me/finance/credentials", creds()); res.Status != http.StatusNoContent || len(res.Raw) != 0 {
		t.Fatalf("PUT = %d %s, want 204 empty", res.Status, res.Raw)
	}
	res := ana.Get("/me/finance")
	if res.Body["configured"] != true {
		t.Errorf("GET after PUT = %s", res.Raw)
	}
	if res := bob.Get("/me/finance"); res.Body["configured"] != false {
		t.Errorf("another User sees %s, want configured false", res.Raw)
	}

	// Replace, then check what is at rest.
	if res := ana.Put("/me/finance/credentials", map[string]any{"clientId": " new-id ", "clientSecret": "new-secret"}); res.Status != http.StatusNoContent {
		t.Fatalf("replace = %d %s", res.Status, res.Raw)
	}
	var idEnc, secEnc []byte
	var ver int
	err := app.DB.QueryRow(context.Background(),
		`SELECT client_id_enc, client_secret_enc, key_version FROM finance_credentials`).Scan(&idEnc, &secEnc, &ver)
	if err != nil {
		t.Fatal(err)
	}
	if ver != 1 || bytes.Contains(idEnc, []byte("new-id")) || bytes.Contains(secEnc, []byte("new-secret")) {
		t.Errorf("row not sealed: version %d", ver)
	}

	if res := ana.Delete("/me/finance/credentials"); res.Status != http.StatusNoContent {
		t.Errorf("DELETE = %d", res.Status)
	}
	if res := ana.Delete("/me/finance/credentials"); res.Status != http.StatusNoContent {
		t.Errorf("second DELETE = %d, want 204", res.Status)
	}
	if res := ana.Get("/me/finance"); res.Body["configured"] != false {
		t.Errorf("GET after DELETE = %s", res.Raw)
	}
}

func TestInvalidCredentialsAreRefused(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	for name, body := range map[string]map[string]any{
		"blank id":      {"clientId": "  ", "clientSecret": testSecret},
		"missing":       {"clientId": testClientID},
		"too long":      {"clientId": testClientID, "clientSecret": strings.Repeat("x", 201)},
		"control chars": {"clientId": "a\nb", "clientSecret": testSecret},
		"unknown field": {"clientId": testClientID, "clientSecret": testSecret, "x": 1},
	} {
		if res := ana.Put("/me/finance/credentials", body); res.Status != http.StatusBadRequest {
			t.Errorf("%s: = %d %s, want 400", name, res.Status, res.Raw)
		}
	}
	res := ana.Put("/me/finance/credentials", map[string]any{"clientId": "", "clientSecret": testSecret})
	fields, _ := res.Body["fields"].(map[string]any)
	if _, ok := fields["clientId"]; !ok || res.Body["error"] != "invalid credentials" {
		t.Errorf("body = %s, want fields.clientId", res.Raw)
	}
	if ana.Get("/me/finance").Body["configured"] != false {
		t.Error("a refused PUT saved something")
	}
}

func TestCredentialsNeverAppearInResponsesOrLogs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	ana := app.SignInAs("ana@example.com")

	for _, res := range []apitest.Response{
		ana.Put("/me/finance/credentials", creds()),
		ana.Get("/me/finance"),
		ana.Put("/me/finance/credentials", map[string]any{"clientId": testClientID, "clientSecret": testSecret + "\n"}),
		ana.Delete("/me/finance/credentials"),
	} {
		for _, s := range []string{testClientID, testSecret} {
			if bytes.Contains(res.Raw, []byte(s)) {
				t.Errorf("response %d leaks a credential", res.Status)
			}
		}
	}
	for _, s := range []string{testClientID, testSecret} {
		if app.Logs.Contains(s) {
			t.Error("logs contain a credential")
		}
	}
}

func TestWithoutKeyFinanceFailsClosed(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(nil, "ana@example.com"))
	ana, bob := app.SignInAs("ana@example.com"), app.SignInAs("bob@example.com")

	for _, res := range []apitest.Response{ana.Get("/me/finance"), ana.Put("/me/finance/credentials", creds())} {
		if res.Status != http.StatusServiceUnavailable || res.Body["error"] != "finance not configured" {
			t.Errorf("allowed User = %d %s, want 503 finance not configured", res.Status, res.Raw)
		}
	}
	if res := bob.Get("/me/finance"); res.Status != http.StatusForbidden {
		t.Errorf("outsider = %d, want 403", res.Status)
	}
}
