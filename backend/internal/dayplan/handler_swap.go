package dayplan

import (
	"context"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// maxSwapBody is far above any valid offer (two ids); it only bounds abuse.
const maxSwapBody = 1024

// OfferSwap offers a Swap: the caller's Task for another Resident's. Nothing
// names a Resident; the recipient is whoever holds the requested Task. A
// malformed id cannot name a Task, so it is the same 404 as an unknown one.
func (h *Handler) OfferSwap(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferedTaskID   string `json:"offeredTaskId"`
		RequestedTaskID string `json:"requestedTaskId"`
	}
	if !httpx.DecodeBody(w, r, &body, maxSwapBody, true) {
		return
	}
	if !chores.ValidID(body.OfferedTaskID) || !chores.ValidID(body.RequestedTaskID) {
		httpx.WriteError(w, http.StatusNotFound, "task not found")
		return
	}
	m := identity.CurrentMembership(r.Context())
	if err := h.planner.OfferSwap(r.Context(), m.Home.ID, m.ResidentID, body.OfferedTaskID, body.RequestedTaskID, h.clock.Now()); err != nil {
		h.taskActionFailed(w, err)
		return
	}
	h.Get(w, r)
}

type swapAction func(ctx context.Context, homeID, residentID, offerID string) error

// changeSwap runs an answer to the offer of the path as the caller, then
// answers with the Day Plan.
func (h *Handler) changeSwap(w http.ResponseWriter, r *http.Request, do swapAction) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "swap_not_found")
		return
	}
	m := identity.CurrentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		h.taskActionFailed(w, err)
		return
	}
	h.Get(w, r)
}

// AcceptSwap answers POST /home/swaps/{id}/accept.
func (h *Handler) AcceptSwap(w http.ResponseWriter, r *http.Request) {
	h.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return h.planner.AcceptSwap(ctx, homeID, residentID, id, h.clock.Now())
	})
}

// DeclineSwap answers POST /home/swaps/{id}/decline.
func (h *Handler) DeclineSwap(w http.ResponseWriter, r *http.Request) {
	h.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return h.planner.DeclineSwap(ctx, homeID, residentID, id, h.clock.Now())
	})
}

// CancelSwap answers POST /home/swaps/{id}/cancel.
func (h *Handler) CancelSwap(w http.ResponseWriter, r *http.Request) {
	h.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return h.planner.CancelSwap(ctx, homeID, residentID, id, h.clock.Now())
	})
}
