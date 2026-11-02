package residents

import (
	"errors"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

type moveBody struct {
	CompletedAt string `json:"completedAt"`
}

var moveErrors = []struct {
	err    error
	status int
	code   string
}{
	{dayplan.ErrCompletionNotFound, http.StatusNotFound, "completion not found"},
	{dayplan.ErrNotYours, http.StatusConflict, "not_yours"},
	{dayplan.ErrInFuture, http.StatusBadRequest, "in_future"},
	{dayplan.ErrTooOld, http.StatusBadRequest, "too_old"},
	{dayplan.ErrBeforeTask, http.StatusBadRequest, "before_task"},
}

// MoveCompletion answers PATCH /home/completions/{id}: the caller re-dates a
// Completion they are named on (ADR 0018) and gets their own detail back.
func (h *Handler) MoveCompletion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "completion not found")
		return
	}
	var body moveBody
	if !httpx.DecodeBody(w, r, &body, 1<<10, true) {
		return
	}
	at, err := time.Parse(time.RFC3339, body.CompletedAt)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_completed_at")
		return
	}
	m := identity.CurrentMembership(r.Context())
	err = h.mover.MoveCompletion(r.Context(), m.Home.ID, m.ResidentID, id, at, h.clock.Now())
	for _, e := range moveErrors {
		if errors.Is(err, e.err) {
			httpx.WriteError(w, e.status, e.code)
			return
		}
	}
	if err != nil {
		httpx.InternalError(w, h.log, "move completion", err)
		return
	}
	out, err := h.detail(r.Context(), m, m.ResidentID)
	if err != nil {
		httpx.InternalError(w, h.log, "move completion", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
