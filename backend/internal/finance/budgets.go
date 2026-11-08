package finance

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// PutBudget answers PUT /me/finance/budgets/{category}: sets the monthly limit,
// or removes it with null. A missing limitCents is 400, not "remove".
func (h *Handler) PutBudget(w http.ResponseWriter, r *http.Request) {
	category := r.PathValue("category")
	if !slices.Contains(SpendingCategories, category) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid category")
		return
	}
	var req map[string]json.RawMessage
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	raw, present := req["limitCents"]
	if !present || len(req) != 1 {
		httpx.WriteError(w, http.StatusBadRequest, "invalid limit")
		return
	}
	var cents *int64 // a float or string fails to unmarshal
	if err := json.Unmarshal(raw, &cents); err != nil || (cents != nil && (*cents < 1 || *cents > maxBillCents)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid limit")
		return
	}
	if err := h.store.SetBudget(r.Context(), identity.CurrentUser(r.Context()).ID, category, cents, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set budget", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
