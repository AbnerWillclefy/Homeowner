package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/invites"
)

const maxAcceptBody = 1024

// inviteFailure answers the errors shared by lookup and accept. It returns
// false if err is not one of them. An unknown or malformed token is the same
// 404; used and expired are 410 with distinct codes.
func inviteFailure(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, invites.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, invites.ErrUsed):
		writeError(w, http.StatusGone, "used")
	case errors.Is(err, invites.ErrExpired):
		writeError(w, http.StatusGone, "expired")
	default:
		return false
	}
	return true
}

func (s *server) postInvite(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	token, expiresAt, err := s.invites.Create(r.Context(), m.Home.ID, m.ResidentID, s.deps.Clock.Now())
	if errors.Is(err, invites.ErrTooManyOpen) {
		writeError(w, http.StatusTooManyRequests, "too many open invites")
		return
	}
	if err != nil {
		s.deps.Logger.Error("create invite", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"token":     token,
		"expiresAt": expiresAt.UTC().Format(time.RFC3339),
	})
}

// getInvite is open to signed-out callers, so it says only whether the link is
// good: never the Home, its creator or any Resident. It does not write.
func (s *server) getInvite(w http.ResponseWriter, r *http.Request) {
	err := s.invites.Lookup(r.Context(), r.PathValue("token"), s.deps.Clock.Now())
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]bool{"valid": true})
		return
	}
	if inviteFailure(w, err) {
		return
	}
	s.deps.Logger.Error("look up invite", "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (s *server) acceptInvite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ConfirmLeave bool `json:"confirmLeave"`
	}
	if r.ContentLength != 0 && !decodeBody(w, r, &body, maxAcceptBody, true) {
		return
	}
	m, err := s.invites.Accept(r.Context(), currentUser(r.Context()).ID, r.PathValue("token"), body.ConfirmLeave, s.deps.Clock.Now())
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, toHomeResponse(m.Home))
	case inviteFailure(w, err):
	case errors.Is(err, invites.ErrAlreadyHere):
		writeError(w, http.StatusConflict, "already_here")
	case errors.Is(err, invites.ErrWouldLeaveHome):
		writeError(w, http.StatusConflict, "leaves current home")
	case errors.Is(err, homes.ErrAlreadyResident):
		writeError(w, http.StatusConflict, "already a resident")
	default:
		s.deps.Logger.Error("accept invite", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
