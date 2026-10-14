package tasks

import (
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Handler serves GET /home/tasks.
type Handler struct {
	store *Store
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clock: clk, log: log}
}

// List answers the Home's open pool. It first brings the Home's Tasks up to
// date for today in the Home's zone, so Residents never see a stale pool.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	home := identity.CurrentMembership(r.Context()).Home.ID
	if err := h.store.Refresh(r.Context(), home, h.clock.Now()); err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	open, err := h.store.ListOpen(r.Context(), home)
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"tasks": open})
}
