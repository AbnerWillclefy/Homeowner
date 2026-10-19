package dayplan

import (
	"context"
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// taskActionError maps a Day Plan action's error to its status and stable
// code. The code is the `error` the PWA switches on.
var taskActionErrors = []struct {
	err    error
	status int
	code   string
}{
	{ErrTaskNotFound, http.StatusNotFound, "task not found"},
	{ErrNoPlanToday, http.StatusConflict, "no_plan_today"},
	{ErrNotProposed, http.StatusConflict, "not_proposed"},
	{ErrAlreadyCommitted, http.StatusConflict, "already_committed"},
	{ErrNotInPool, http.StatusConflict, "not_in_pool"},
	{ErrNotYours, http.StatusConflict, "not_yours"},
	{ErrAlreadyDone, http.StatusConflict, "already_done"},
	{ErrTwoPersonTask, http.StatusConflict, "two_person_task"},
	{ErrRestricted, http.StatusConflict, "restricted"},
	{ErrDrained, http.StatusConflict, "drained"},
	{ErrNotHeldByOther, http.StatusConflict, "not_held_by_other"},
	{ErrSwapPending, http.StatusConflict, "swap_pending"},
	{ErrSwapNotFound, http.StatusNotFound, "swap_not_found"},
	{ErrSwapClosed, http.StatusConflict, "swap_closed"},
	{ErrSwapStale, http.StatusConflict, "swap_stale"},
	{ErrRecipientDrained, http.StatusConflict, "recipient_drained"},
}

func (h *Handler) taskActionFailed(w http.ResponseWriter, err error) {
	for _, e := range taskActionErrors {
		if errors.Is(err, e.err) {
			httpx.WriteError(w, e.status, e.code)
			return
		}
	}
	httpx.InternalError(w, h.log, "chores", err)
}

type taskAction func(ctx context.Context, homeID, residentID, taskID string) error

// changeTask runs an action on the caller's own Resident and the Task of the
// path, then answers with the Day Plan as GET /home/day-plan does. A malformed
// id cannot name a Task, so it is the same 404 as an unknown one, before the
// database is asked.
func (h *Handler) changeTask(w http.ResponseWriter, r *http.Request, do taskAction) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "task not found")
		return
	}
	m := identity.CurrentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		h.taskActionFailed(w, err)
		return
	}
	h.Get(w, r)
}

// Accept answers POST /home/tasks/{id}/accept.
func (h *Handler) Accept(w http.ResponseWriter, r *http.Request) {
	h.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return h.planner.Accept(ctx, homeID, residentID, taskID, h.clock.Now())
	})
}

// Refuse answers POST /home/tasks/{id}/refuse.
func (h *Handler) Refuse(w http.ResponseWriter, r *http.Request) {
	h.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return h.planner.Refuse(ctx, homeID, residentID, taskID, h.clock.Now())
	})
}

// Take answers POST /home/tasks/{id}/take.
func (h *Handler) Take(w http.ResponseWriter, r *http.Request) {
	h.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return h.planner.Take(ctx, homeID, residentID, taskID, h.clock.Now())
	})
}

// Complete answers POST /home/tasks/{id}/complete.
func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	h.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return h.planner.Complete(ctx, homeID, residentID, taskID, h.clock.Now())
	})
}

// AcceptAll answers POST /home/day-plan/accept-all.
func (h *Handler) AcceptAll(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	if err := h.planner.AcceptAll(r.Context(), m.Home.ID, m.ResidentID, h.clock.Now()); err != nil {
		h.taskActionFailed(w, err)
		return
	}
	h.Get(w, r)
}
