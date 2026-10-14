package invites

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const maxAcceptBody = 1024

// Handler serves the Invite routes.
type Handler struct {
	store *Store
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clock: clk, log: log}
}

// writeFailure answers the errors shared by lookup and accept. It returns
// false if err is not one of them. An unknown or malformed token is the same
// 404; used and expired are 410 with distinct codes.
func writeFailure(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "not found")
	case errors.Is(err, ErrUsed):
		httpx.WriteError(w, http.StatusGone, "used")
	case errors.Is(err, ErrExpired):
		httpx.WriteError(w, http.StatusGone, "expired")
	default:
		return false
	}
	return true
}

// Create answers POST /home/invites.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	token, expiresAt, err := h.store.Create(r.Context(), m.Home.ID, m.ResidentID, h.clock.Now())
	if errors.Is(err, ErrTooManyOpen) {
		httpx.WriteError(w, http.StatusTooManyRequests, "too many open invites")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "create invite", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{
		"token":     token,
		"expiresAt": expiresAt.UTC().Format(time.RFC3339),
	})
}

// Lookup is open to signed-out callers, so it says only whether the link is
// good: never the Home, its creator or any Resident. It does not write.
func (h *Handler) Lookup(w http.ResponseWriter, r *http.Request) {
	err := h.store.Lookup(r.Context(), r.PathValue("token"), h.clock.Now())
	if err == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]bool{"valid": true})
		return
	}
	if writeFailure(w, err) {
		return
	}
	httpx.InternalError(w, h.log, "look up invite", err)
}

// Accept answers POST /invites/{token}/accept.
func (h *Handler) Accept(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ConfirmLeave bool `json:"confirmLeave"`
	}
	if r.ContentLength != 0 && !httpx.DecodeBody(w, r, &body, maxAcceptBody, true) {
		return
	}
	m, err := h.store.Accept(r.Context(), identity.CurrentUser(r.Context()).ID, r.PathValue("token"), body.ConfirmLeave, h.clock.Now())
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, homes.NewResponse(m.Home))
	case writeFailure(w, err):
	case errors.Is(err, ErrAlreadyHere):
		httpx.WriteError(w, http.StatusConflict, "already_here")
	case errors.Is(err, ErrWouldLeaveHome):
		httpx.WriteError(w, http.StatusConflict, "leaves current home")
	case errors.Is(err, homes.ErrAlreadyResident):
		httpx.WriteError(w, http.StatusConflict, "already a resident")
	default:
		httpx.InternalError(w, h.log, "accept invite", err)
	}
}
