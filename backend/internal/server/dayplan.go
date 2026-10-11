package server

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// dayPlanResponse is the Day Plan plus the Home's Allocation time, so the PWA
// can say when a plan that does not exist yet will come.
type dayPlanResponse struct {
	AllocationTime string `json:"allocationTime"`
	dayplan.View
}

// getDayPlan answers the caller's Home's Day Plan for today in the Home's zone:
// the caller's Tasks, other Residents' Tasks and the pool that remains. It only
// reads the plan the Allocation job stored. Before the Allocation time there is
// no run, and the answer is `planned: false` with the open pool, not a 404.
func (s *server) getDayPlan(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	view, err := s.dayPlans.Today(r.Context(), m.Home.ID, m.Home.Timezone, m.ResidentID, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dayPlanResponse{AllocationTime: m.Home.AllocationTime, View: view})
}
