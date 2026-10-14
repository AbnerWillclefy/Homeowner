package server

import (
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// maxCheckInBody is far above any valid Check-in; it only bounds abuse.
const maxCheckInBody = 4 * 1024

// checkInResponse is the caller's Check-in for the Home's local date. Level is
// null and Restrictions empty until they check in.
type checkInResponse struct {
	Date         string   `json:"date"`
	CheckedIn    bool     `json:"checkedIn"`
	Level        *string  `json:"level"`
	Restrictions []string `json:"restrictions"`
}

func newCheckInResponse(date allocation.Date, in checkin.CheckIn, found bool) checkInResponse {
	out := checkInResponse{Date: date.Time().Format(time.DateOnly), Restrictions: []string{}}
	if !found {
		return out
	}
	level := string(in.Level)
	out.CheckedIn, out.Level = true, &level
	// Restrictions come back in the order of GET /demands.
	for _, d := range vocab.Demands() {
		if slices.Contains(in.Demands, d) {
			out.Restrictions = append(out.Restrictions, d)
		}
	}
	return out
}

// getCheckIn answers the caller's Check-in for today in the Home's zone. The
// PWA asks it whenever it opens. It only reads: it never plans.
func (s *server) getCheckIn(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	date, err := dayplan.LocalDate(m.Home.Timezone, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	in, found, err := s.checkIns.Get(r.Context(), m.ResidentID, date)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, newCheckInResponse(date, in, found))
}

// putCheckIn sets the caller's Check-in for today, replacing the level and the
// day Restrictions of an earlier one, and plans the caller again when today's
// plan exists. It is idempotent.
func (s *server) putCheckIn(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Level        *string  `json:"level"`
		Restrictions []string `json:"restrictions"`
	}
	if !decodeBody(w, r, &body, maxCheckInBody, true) {
		return
	}
	var level string
	if body.Level != nil {
		level = *body.Level
	}
	in, err := checkin.New(level, body.Restrictions)
	switch {
	case errors.Is(err, checkin.ErrInvalidLevel):
		writeError(w, http.StatusBadRequest, "level must be one of drained, low, normal, energized")
		return
	case err != nil:
		writeError(w, http.StatusBadRequest, "restrictions must be known demands")
		return
	}
	m := currentMembership(r.Context())
	date, err := s.planner.CheckIn(r.Context(), m.Home.ID, m.ResidentID, in, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, newCheckInResponse(date, in, true))
}
