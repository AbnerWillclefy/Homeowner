package dayplan

import (
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
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

// GetCheckIn answers the caller's Check-in for today in the Home's zone. The
// PWA asks it whenever it opens. It only reads: it never plans.
func (h *Handler) GetCheckIn(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	date, err := LocalDate(m.Home.Timezone, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	in, found, err := h.checkIns.Get(r.Context(), m.ResidentID, date)
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newCheckInResponse(date, in, found))
}

// PutCheckIn sets the caller's Check-in for today, replacing the level and the
// day Restrictions of an earlier one, and plans the caller again when today's
// plan exists. It is idempotent.
func (h *Handler) PutCheckIn(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Level        *string  `json:"level"`
		Restrictions []string `json:"restrictions"`
	}
	if !httpx.DecodeBody(w, r, &body, maxCheckInBody, true) {
		return
	}
	var level string
	if body.Level != nil {
		level = *body.Level
	}
	in, err := checkin.New(level, body.Restrictions)
	switch {
	case errors.Is(err, checkin.ErrInvalidLevel):
		httpx.WriteError(w, http.StatusBadRequest, "level must be one of drained, low, normal, energized")
		return
	case err != nil:
		httpx.WriteError(w, http.StatusBadRequest, "restrictions must be known demands")
		return
	}
	m := identity.CurrentMembership(r.Context())
	date, err := h.planner.CheckIn(r.Context(), m.Home.ID, m.ResidentID, in, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newCheckInResponse(date, in, true))
}
