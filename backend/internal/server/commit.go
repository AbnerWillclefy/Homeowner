package server

import (
	"context"
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// taskActionError maps a Day Plan action's error to its status and stable
// code. The code is the `error` the PWA switches on.
var taskActionErrors = []struct {
	err    error
	status int
	code   string
}{
	{dayplan.ErrTaskNotFound, http.StatusNotFound, "task not found"},
	{dayplan.ErrNoPlanToday, http.StatusConflict, "no_plan_today"},
	{dayplan.ErrNotProposed, http.StatusConflict, "not_proposed"},
	{dayplan.ErrAlreadyCommitted, http.StatusConflict, "already_committed"},
	{dayplan.ErrNotInPool, http.StatusConflict, "not_in_pool"},
	{dayplan.ErrNotYours, http.StatusConflict, "not_yours"},
	{dayplan.ErrAlreadyDone, http.StatusConflict, "already_done"},
	{dayplan.ErrTwoPersonTask, http.StatusConflict, "two_person_task"},
	{dayplan.ErrRestricted, http.StatusConflict, "restricted"},
	{dayplan.ErrNotHeldByOther, http.StatusConflict, "not_held_by_other"},
	{dayplan.ErrSwapPending, http.StatusConflict, "swap_pending"},
	{dayplan.ErrSwapNotFound, http.StatusNotFound, "swap_not_found"},
	{dayplan.ErrSwapClosed, http.StatusConflict, "swap_closed"},
	{dayplan.ErrSwapStale, http.StatusConflict, "swap_stale"},
	{dayplan.ErrRecipientDrained, http.StatusConflict, "recipient_drained"},
}

func (s *server) taskActionFailed(w http.ResponseWriter, err error) {
	for _, e := range taskActionErrors {
		if errors.Is(err, e.err) {
			writeError(w, e.status, e.code)
			return
		}
	}
	s.internalError(w, err)
}

type taskAction func(ctx context.Context, homeID, residentID, taskID string) error

// changeTask runs an action on the caller's own Resident and the Task of the
// path, then answers with the Day Plan as GET /home/day-plan does. A malformed
// id cannot name a Task, so it is the same 404 as an unknown one, before the
// database is asked.
func (s *server) changeTask(w http.ResponseWriter, r *http.Request, do taskAction) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	m := currentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		s.taskActionFailed(w, err)
		return
	}
	s.getDayPlan(w, r)
}

func (s *server) postAccept(w http.ResponseWriter, r *http.Request) {
	s.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return s.planner.Accept(ctx, homeID, residentID, taskID, s.deps.Clock.Now())
	})
}

func (s *server) postRefuse(w http.ResponseWriter, r *http.Request) {
	s.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return s.planner.Refuse(ctx, homeID, residentID, taskID, s.deps.Clock.Now())
	})
}

func (s *server) postTake(w http.ResponseWriter, r *http.Request) {
	s.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return s.planner.Take(ctx, homeID, residentID, taskID, s.deps.Clock.Now())
	})
}

func (s *server) postComplete(w http.ResponseWriter, r *http.Request) {
	s.changeTask(w, r, func(ctx context.Context, homeID, residentID, taskID string) error {
		return s.planner.Complete(ctx, homeID, residentID, taskID, s.deps.Clock.Now())
	})
}

func (s *server) postAcceptAll(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	if err := s.planner.AcceptAll(r.Context(), m.Home.ID, m.ResidentID, s.deps.Clock.Now()); err != nil {
		s.taskActionFailed(w, err)
		return
	}
	s.getDayPlan(w, r)
}
