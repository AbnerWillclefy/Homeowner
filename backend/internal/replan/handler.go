package replan

import (
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Handler serves the staging-only replan route.
type Handler struct {
	replanner Replanner
	log       *slog.Logger
}

// NewHandler returns the handler over replanner.
func NewHandler(replanner Replanner, log *slog.Logger) *Handler {
	return &Handler{replanner: replanner, log: log}
}

// Replan answers POST /dev/replan: it asks for a fresh plan of the caller's Home
// and answers 202 without waiting for it. The Home is the Membership's, and the
// request body is never read, so a body naming another Home changes nothing.
func (h *Handler) Replan(w http.ResponseWriter, r *http.Request) {
	homeID := identity.CurrentMembership(r.Context()).Home.ID
	if err := h.replanner.Replan(r.Context(), homeID); err != nil {
		h.log.Error("replan request failed", "home", homeID, "error", err.Error())
		httpx.WriteError(w, http.StatusBadGateway, "replan unavailable")
		return
	}
	httpx.WriteJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}
