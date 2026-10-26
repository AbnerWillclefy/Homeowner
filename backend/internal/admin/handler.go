// Package admin is the read-only operator API behind the super-admin guard
// (ADR 0017). It reads with SQL only, imports no domain package, and returns
// aggregates and opaque counts: no email, name, user id or Chore title.
package admin

import (
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Handler serves the /admin routes of this package.
type Handler struct {
	store *Store
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clock: clk, log: log}
}

// Overview answers GET /admin/overview?range=7d|30d. `range` is required: a
// missing, empty or unknown value is 400 "invalid range", because the page
// always sends one. A store error, a statement timeout included, is logged and
// answered 500.
func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	rng, err := ParseRange(r.URL.Query().Get("range"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid range")
		return
	}
	days := rng.Window(h.clock.Now())
	from, to := days[0], days[len(days)-1]

	ov, err := h.store.Overview(r.Context(), from, to)
	if err != nil {
		httpx.InternalError(w, h.log, "admin overview", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, OverviewResponse{
		Range: rng.Name, From: from, To: to,
		Totals: ov.Totals, Active: ov.Active, Days: ZeroFill(days, ov.Days),
	})
}
