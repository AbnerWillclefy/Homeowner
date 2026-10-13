package server

import (
	"context"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// maxSwapBody is far above any valid offer (two ids); it only bounds abuse.
const maxSwapBody = 1024

// postSwap offers a Swap: the caller's Task for another Resident's. Nothing
// names a Resident; the recipient is whoever holds the requested Task. A
// malformed id cannot name a Task, so it is the same 404 as an unknown one.
func (s *server) postSwap(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferedTaskID   string `json:"offeredTaskId"`
		RequestedTaskID string `json:"requestedTaskId"`
	}
	if !decodeBody(w, r, &body, maxSwapBody, true) {
		return
	}
	if !chores.ValidID(body.OfferedTaskID) || !chores.ValidID(body.RequestedTaskID) {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	m := currentMembership(r.Context())
	if err := s.planner.OfferSwap(r.Context(), m.Home.ID, m.ResidentID, body.OfferedTaskID, body.RequestedTaskID, s.deps.Clock.Now()); err != nil {
		s.taskActionFailed(w, err)
		return
	}
	s.getDayPlan(w, r)
}

type swapAction func(ctx context.Context, homeID, residentID, offerID string) error

// changeSwap runs an answer to the offer of the path as the caller, then
// answers with the Day Plan.
func (s *server) changeSwap(w http.ResponseWriter, r *http.Request, do swapAction) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		writeError(w, http.StatusNotFound, "swap_not_found")
		return
	}
	m := currentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		s.taskActionFailed(w, err)
		return
	}
	s.getDayPlan(w, r)
}

func (s *server) postSwapAccept(w http.ResponseWriter, r *http.Request) {
	s.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return s.planner.AcceptSwap(ctx, homeID, residentID, id, s.deps.Clock.Now())
	})
}

func (s *server) postSwapDecline(w http.ResponseWriter, r *http.Request) {
	s.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return s.planner.DeclineSwap(ctx, homeID, residentID, id, s.deps.Clock.Now())
	})
}

func (s *server) postSwapCancel(w http.ResponseWriter, r *http.Request) {
	s.changeSwap(w, r, func(ctx context.Context, homeID, residentID, id string) error {
		return s.planner.CancelSwap(ctx, homeID, residentID, id, s.deps.Clock.Now())
	})
}
