package finance

import "testing"

func TestItemWireStatus(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ name, status, exec, want string }{
		{"updated", "UPDATED", "SUCCESS", "ok"},
		{"updating", "UPDATING", "", "ok"},
		{"login error", "LOGIN_ERROR", "INVALID_CREDENTIALS", "reconnect"},
		{"login error without execution status", "LOGIN_ERROR", "", "reconnect"},
		{"waiting user input", "WAITING_USER_INPUT", "", "reconnect"},
		{"outdated, invalid credentials", "OUTDATED", "INVALID_CREDENTIALS", "reconnect"},
		{"outdated, credentials reset", "OUTDATED", "ACCOUNT_CREDENTIALS_RESET", "reconnect"},
		{"outdated, authorization pending", "OUTDATED", "USER_AUTHORIZATION_PENDING", "reconnect"},
		{"outdated, authorization revoked", "OUTDATED", "USER_AUTHORIZATION_REVOKED", "reconnect"},
		{"outdated, account locked", "OUTDATED", "ACCOUNT_LOCKED", "reconnect"},
		{"outdated, site unavailable", "OUTDATED", "SITE_NOT_AVAILABLE", "ok"},
		{"outdated, no execution status", "OUTDATED", "", "ok"},
		{"unknown status", "SOMETHING_NEW", "INVALID_CREDENTIALS", "ok"},
		{"empty", "", "", "ok"},
	} {
		if got := ItemWireStatus(tc.status, tc.exec); got != tc.want {
			t.Errorf("%s: ItemWireStatus(%q, %q) = %q, want %q", tc.name, tc.status, tc.exec, got, tc.want)
		}
	}
}
