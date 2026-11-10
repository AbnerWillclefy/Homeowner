package server

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// requireFinance wraps a handler so it only runs for a signed-in User whose
// verified email is on the allowlist. No token is 401 (requireUser); a User
// off the list, or an empty list, is 403. After that check, a missing
// encryption key is 503 on every finance route (fail closed), so an outsider
// learns nothing about the configuration.
func (s *server) requireFinance(allow finance.Allowlist, next http.Handler) http.Handler {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request) {
		if !allow.Allows(identity.CurrentUser(r.Context()).Email) {
			s.deps.Logger.Info("finance access refused", "path", r.URL.Path)
			httpx.WriteError(w, http.StatusForbidden, "forbidden")
			return
		}
		if s.deps.FinanceKey == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "finance not configured")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// financeMux holds the /me/finance routes. The guard wraps it once, so every
// path under the prefix, known or not, meets the allowlist first.
func financeMux(h *finance.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /me/finance", h.Status)
	mux.HandleFunc("DELETE /me/finance", h.DeleteAll)
	mux.HandleFunc("GET /me/finance/transactions", h.Month)
	mux.HandleFunc("GET /me/finance/history", h.History)
	mux.HandleFunc("GET /me/finance/daily", h.Daily)
	mux.HandleFunc("GET /me/finance/commitments", h.Commitments)
	mux.HandleFunc("PUT /me/finance/income", h.PutIncome)
	mux.HandleFunc("PUT /me/finance/reserve", h.PutReserve)
	mux.HandleFunc("PUT /me/finance/contribution", h.PutContribution)
	mux.HandleFunc("GET /me/finance/savings", h.Savings)
	mux.HandleFunc("PUT /me/finance/budgets/{category}", h.PutBudget)
	mux.HandleFunc("PATCH /me/finance/transactions/{id}", h.PatchTransaction)
	mux.HandleFunc("POST /me/finance/bills", h.CreateBill)
	mux.HandleFunc("GET /me/finance/bills", h.ListBills)
	mux.HandleFunc("GET /me/finance/bill-suggestions", h.BillSuggestions)
	mux.HandleFunc("POST /me/finance/bill-suggestions/dismissals", h.DismissBillSuggestion)
	mux.HandleFunc("PUT /me/finance/bills/{id}", h.UpdateBill)
	mux.HandleFunc("DELETE /me/finance/bills/{id}", h.DeleteBill)
	mux.HandleFunc("PUT /me/finance/bills/{id}/payments/{month}", h.PayBill)
	mux.HandleFunc("DELETE /me/finance/bills/{id}/payments/{month}", h.UnpayBill)
	mux.HandleFunc("POST /me/finance/connect-token", h.ConnectToken)
	mux.HandleFunc("POST /me/finance/items", h.ConnectItem)
	mux.HandleFunc("PUT /me/finance/credentials", h.PutCredentials)
	mux.HandleFunc("DELETE /me/finance/credentials", h.DeleteCredentials)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
	})
	return mux
}
