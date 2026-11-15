package finance

// ItemWireStatus maps Pluggy's item state machine onto the two words the API
// owns: "reconnect" when the User must act at the bank or in Pluggy Connect
// (LOGIN_ERROR and WAITING_USER_INPUT, or OUTDATED with a credentials or
// consent executionStatus), else "ok". An empty or unknown status is "ok", so
// a new Pluggy word never raises a false alarm.
// Source: Pluggy's item lifecycle docs (docs.pluggy.ai/docs/item-lifecycle).
// It only sees Items the sync reached: if the User's Pluggy credentials fail at
// Auth, no Item is read and statuses go stale; the credentials card shows that case.
func ItemWireStatus(status, executionStatus string) string {
	switch status {
	case "LOGIN_ERROR", "WAITING_USER_INPUT":
		return "reconnect"
	case "OUTDATED":
		switch executionStatus {
		case "INVALID_CREDENTIALS", "INVALID_CREDENTIALS_MFA", "ACCOUNT_CREDENTIALS_RESET", "ACCOUNT_LOCKED",
			"USER_AUTHORIZATION_PENDING", "USER_AUTHORIZATION_NOT_GRANTED", "USER_AUTHORIZATION_REVOKED":
			return "reconnect"
		}
	}
	return "ok"
}
