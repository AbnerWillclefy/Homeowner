package server

import (
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// maxProfileBody is far above any valid profile body; it only bounds abuse.
const maxProfileBody = 4 * 1024

// weekdayNames are the wire keys for the Baseline, in time.Weekday order
// (0 = Sunday, as in the database).
var weekdayNames = [...]string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}

func (s *server) getCategories(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string][]string{"categories": vocab.Categories()})
}

func (s *server) getDemands(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string][]string{"demands": vocab.Demands()})
}

func (s *server) getProfile(w http.ResponseWriter, r *http.Request) {
	p, err := s.profile.Load(r.Context(), currentUser(r.Context()).ID)
	if err != nil {
		s.profileError(w, "load profile", err)
		return
	}
	baseline := make(map[string]*int, len(weekdayNames))
	for i, name := range weekdayNames {
		baseline[name] = nil
		if points, ok := p.Baseline[time.Weekday(i)]; ok {
			baseline[name] = &points
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"baseline":     baseline,
		"preferences":  p.Preferences,
		"restrictions": p.Restrictions,
	})
}

func (s *server) profileError(w http.ResponseWriter, what string, err error) {
	s.deps.Logger.Error(what, "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}
