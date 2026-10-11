package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
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
	// Restrictions come back in the order of GET /demands.
	demands := vocab.Demands()
	restrictions := make([]string, 0, len(p.Restrictions))
	for _, d := range demands {
		if slices.Contains(p.Restrictions, d) {
			restrictions = append(restrictions, d)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"baseline":     baseline,
		"preferences":  p.Preferences,
		"restrictions": restrictions,
	})
}

// putBaseline sets or clears the Baseline of the weekdays in the body and
// leaves the others alone, so a stale screen cannot erase a day. A number sets
// the day, null clears it.
func (s *server) putBaseline(w http.ResponseWriter, r *http.Request) {
	var body map[string]json.RawMessage
	if !decodeBody(w, r, &body, maxProfileBody, true) {
		return
	}
	if len(body) == 0 {
		writeError(w, http.StatusBadRequest, "baseline must name at least one weekday")
		return
	}
	set := map[time.Weekday]int{}
	var cleared []time.Weekday
	for key, raw := range body {
		day := slices.Index(weekdayNames[:], key)
		if day < 0 {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("%s is not a weekday; use sunday to saturday", key))
			return
		}
		if string(raw) == "null" {
			cleared = append(cleared, time.Weekday(day))
			continue
		}
		points, err := strconv.Atoi(string(raw))
		if err != nil || points < 0 || points > profile.MaxBaseline {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("%s must be an integer from 0 to %d, or null to clear it", key, profile.MaxBaseline))
			return
		}
		set[time.Weekday(day)] = points
	}
	if err := s.profile.SetBaseline(r.Context(), currentUser(r.Context()).ID, set, cleared); err != nil {
		s.profileError(w, "set baseline", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// putPreference sets the signed-in User's Preference for a Category; neutral
// removes it. An unknown Category is a 404, not a 400: it is a path that does
// not exist.
func (s *server) putPreference(w http.ResponseWriter, r *http.Request) {
	category := r.PathValue("category")
	if !vocab.IsCategory(category) {
		writeError(w, http.StatusNotFound, "unknown category")
		return
	}
	var body struct {
		Preference string `json:"preference"`
	}
	if !decodeBody(w, r, &body, maxProfileBody, true) {
		return
	}
	switch body.Preference {
	case profile.Like, profile.Neutral, profile.Dislike:
	default:
		writeError(w, http.StatusBadRequest, "preference must be one of like, neutral, dislike")
		return
	}
	if err := s.profile.SetPreference(r.Context(), currentUser(r.Context()).ID, category, body.Preference); err != nil {
		s.profileError(w, "set preference", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) putRestriction(w http.ResponseWriter, r *http.Request) {
	s.changeRestriction(w, r, s.profile.AddRestriction, "add restriction")
}

func (s *server) deleteRestriction(w http.ResponseWriter, r *http.Request) {
	s.changeRestriction(w, r, s.profile.RemoveRestriction, "remove restriction")
}

// changeRestriction is the shared shape of adding and removing a Restriction
// on the Demand in the path; both are idempotent.
func (s *server) changeRestriction(w http.ResponseWriter, r *http.Request, change func(ctx context.Context, userID, demand string) error, what string) {
	demand := r.PathValue("demand")
	if !vocab.IsDemand(demand) {
		writeError(w, http.StatusNotFound, "unknown demand")
		return
	}
	if err := change(r.Context(), currentUser(r.Context()).ID, demand); err != nil {
		s.profileError(w, what, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) profileError(w http.ResponseWriter, what string, err error) {
	s.deps.Logger.Error(what, "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}
