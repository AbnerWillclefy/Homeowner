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

// postDayPlanMe is "get my tasks right away": it plans the caller alone from
// today's pool and answers with the same body as GET /home/day-plan. It takes
// no body and no Resident id, so it can only act on the caller. A rejected day
// is a 200 with `rejected: true`; a failed or refused proposal is a 500 with
// nothing stored.
func (s *server) postDayPlanMe(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	now := s.deps.Clock.Now()
	if _, err := s.planner.PlanResident(r.Context(), m.Home.ID, m.ResidentID, now); err != nil {
		s.internalError(w, err)
		return
	}
	s.writeDayPlan(w, r)
}

// getDayPlan answers the caller's Home's Day Plan for today in the Home's zone:
// the caller's Tasks, other Residents' Tasks and the pool that remains. It only
// reads the plan the Allocation job stored. Before the Allocation time there is
// no run, and the answer is `planned: false` with the open pool, not a 404.
func (s *server) getDayPlan(w http.ResponseWriter, r *http.Request) {
	s.writeDayPlan(w, r)
}

// writeDayPlan answers the caller's Day Plan for today.
func (s *server) writeDayPlan(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	view, err := s.dayPlans.Today(r.Context(), m.Home.ID, m.Home.Timezone, m.ResidentID, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dayPlanResponse{AllocationTime: m.Home.AllocationTime, View: view})
}
