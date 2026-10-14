package dayplan

import (
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Handler serves the Day Plan, its Task and Swap actions and the Check-in.
type Handler struct {
	planner  *Planner
	store    *Store
	checkIns *checkin.Store
	clock    clock.Clock
	log      *slog.Logger
}

// NewHandler returns a Handler that plans with planner and reads through store
// and checkIns.
func NewHandler(planner *Planner, store *Store, checkIns *checkin.Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{planner: planner, store: store, checkIns: checkIns, clock: clk, log: log}
}

// dayPlanResponse is the Day Plan plus the Home's Allocation time, so the PWA
// can say when a plan that does not exist yet will come.
type dayPlanResponse struct {
	AllocationTime string `json:"allocationTime"`
	View
}

// PlanMe is "get my tasks right away": it plans the caller alone from
// today's pool and answers with the same body as GET /home/day-plan. It takes
// no body and no Resident id, so it can only act on the caller. A rejected day
// is a 200 with `rejected: true`; a failed or refused proposal is a 500 with
// nothing stored.
func (h *Handler) PlanMe(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	now := h.clock.Now()
	if _, err := h.planner.PlanResident(r.Context(), m.Home.ID, m.ResidentID, now); err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	h.Get(w, r)
}

// Get answers the caller's Home's Day Plan for today in the Home's zone:
// the caller's Tasks, other Residents' Tasks and the pool that remains. It only
// reads the plan the Allocation job stored. Before the Allocation time there is
// no run, and the answer is `planned: false` with the open pool, not a 404.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	view, err := h.store.Today(r.Context(), m.Home.ID, m.Home.Timezone, m.ResidentID, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dayPlanResponse{AllocationTime: m.Home.AllocationTime, View: view})
}
