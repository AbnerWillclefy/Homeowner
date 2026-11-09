package finance

import (
	"net/http"
	"regexp"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// merchantKeyShape is the alphabet MerchantKey produces, one or more characters.
var merchantKeyShape = regexp.MustCompile(`^[A-Z ]+$`)

// SuggestionResponse is one suggested Bill; the Resident edits it, then POSTs
// it to /me/finance/bills.
type SuggestionResponse struct {
	MerchantKey string `json:"merchantKey"`
	Name        string `json:"name"`
	AmountCents int64  `json:"amountCents"`
	DueDay      int    `json:"dueDay"`
}

// DismissRequest is the body of POST /me/finance/bill-suggestions/dismissals.
type DismissRequest struct {
	MerchantKey string `json:"merchantKey"`
}

// BillSuggestions answers GET /me/finance/bill-suggestions: the merchants that
// charge every month (see SuggestBills), ordered by due day then name.
func (h *Handler) BillSuggestions(w http.ResponseWriter, r *http.Request) {
	now := h.clk.Now()
	first := postedOn(now)
	first = time.Date(first.Year(), first.Month()-suggestMonths, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(first.Year(), first.Month()+suggestMonths, 1, 0, 0, 0, 0, time.UTC)
	txns, bills, dismissed, err := h.store.SuggestionInputs(r.Context(), identity.CurrentUser(r.Context()).ID, first, to)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: bill suggestions", err)
		return
	}
	out := []SuggestionResponse{}
	for _, s := range SuggestBills(txns, bills, dismissed, postedOn(now)) {
		out = append(out, SuggestionResponse{s.MerchantKey, s.Name, s.AmountCents, s.DueDay})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// DismissBillSuggestion answers POST /me/finance/bill-suggestions/dismissals.
// The key need not match anything, so it cannot probe data.
func (h *Handler) DismissBillSuggestion(w http.ResponseWriter, r *http.Request) {
	var req DismissRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if !merchantKeyShape.MatchString(req.MerchantKey) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid merchant key")
		return
	}
	if err := h.store.DismissSuggestion(r.Context(), identity.CurrentUser(r.Context()).ID, req.MerchantKey, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: dismiss suggestion", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
