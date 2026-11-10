package finance

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// ReserveRequest is the body of PUT /me/finance/reserve; null clears the target.
type ReserveRequest struct {
	TargetCents *int64 `json:"targetCents"`
}

// ContributionRequest is the body of PUT /me/finance/contribution. Both fields
// are null to clear, or both set; a share of 0 and of 100 are valid.
type ContributionRequest struct {
	BaseCents           *int64 `json:"baseCents"`
	ReserveSharePercent *int16 `json:"reserveSharePercent"`
}

// SavingsResponse answers GET /me/finance/savings. Goals are in the User's
// order; Investments is empty until the ticket that adds it.
type SavingsResponse struct {
	ReserveTargetCents    *int64         `json:"reserveTargetCents"`
	ContributionBaseCents *int64         `json:"contributionBaseCents"`
	ReserveSharePercent   *int16         `json:"reserveSharePercent"`
	Investments           []string       `json:"investments"`
	Goals                 []GoalResponse `json:"goals"`
}

// PutReserve answers PUT /me/finance/reserve: sets the Emergency reserve target, or clears it with null.
func (h *Handler) PutReserve(w http.ResponseWriter, r *http.Request) {
	var req ReserveRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if v := req.TargetCents; v != nil && (*v <= 0 || *v > maxIncomeCents) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid reserve target")
		return
	}
	if err := h.store.SetReserveTarget(r.Context(), identity.CurrentUser(r.Context()).ID, req.TargetCents, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set reserve target", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PutContribution answers PUT /me/finance/contribution: sets the Monthly
// contribution and the reserve's share of it, or clears both with nulls.
func (h *Handler) PutContribution(w http.ResponseWriter, r *http.Request) {
	var req ContributionRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	base, share := req.BaseCents, req.ReserveSharePercent
	if (base == nil) != (share == nil) ||
		(base != nil && (*base <= 0 || *base > maxIncomeCents)) ||
		(share != nil && (*share < 0 || *share > 100)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid contribution")
		return
	}
	if err := h.store.SetContribution(r.Context(), identity.CurrentUser(r.Context()).ID, base, share, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set contribution", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Savings answers GET /me/finance/savings. A User with no settings row gets nulls, never a 404.
func (h *Handler) Savings(w http.ResponseWriter, r *http.Request) {
	reserve, base, share, err := h.store.SavingsSettings(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read savings", err)
		return
	}
	goals, err := h.store.Goals(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read goals", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, SavingsResponse{reserve, base, share, []string{}, goals})
}
