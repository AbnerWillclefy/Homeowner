package server

import (
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// streakResponse is the caller's Streak on the Home's local date. Current is 0
// when there is none, never null. TodayGrew says today already counts.
type streakResponse struct {
	Date      string `json:"date"`
	Current   int    `json:"current"`
	TodayGrew bool   `json:"todayGrew"`
}

// getStreak answers the caller's Streak. It only reads: it never plans.
func (s *server) getStreak(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	date, err := dayplan.LocalDate(m.Home.Timezone, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	current, grew, err := s.streaks.Current(r.Context(), m.ResidentID, date)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, streakResponse{Date: date.Time().Format(time.DateOnly), Current: current, TodayGrew: grew})
}
