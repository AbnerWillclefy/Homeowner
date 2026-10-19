package residents

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/streak"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
)

// Streaks reads the Streak of many Residents at once. streak.Store is one.
type Streaks interface {
	CurrentFor(ctx context.Context, residentIDs []string, today allocation.Date) (map[string]streak.Reading, error)
}

// Handler serves the /home/residents routes.
type Handler struct {
	store    *Store
	streaks  Streaks
	photoURL func(*string) *string
	clock    clock.Clock
	log      *slog.Logger
}

// NewHandler returns a Handler. photoURL turns a stored photo key into its
// public URL (nil when photos are off).
func NewHandler(store *Store, streaks Streaks, photoURL func(*string) *string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, streaks: streaks, photoURL: photoURL, clock: clk, log: log}
}

// List answers GET /home/residents: every Resident of the caller's Home, the
// caller first, then the others in joining order (never by Streak), each with
// the name to show, their Streak and what they completed today. It only reads:
// it never plans. It costs two queries, whatever the number of Residents.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	today, err := dayplan.LocalDate(m.Home.Timezone, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "list residents", err)
		return
	}
	roster, err := h.store.Roster(r.Context(), m.Home.ID, m.ResidentID)
	if err != nil {
		httpx.InternalError(w, h.log, "list residents", err)
		return
	}
	ids := make([]string, len(roster))
	for i, member := range roster {
		ids[i] = member.ID
	}
	readings, err := h.streaks.CurrentFor(r.Context(), ids, today)
	if err != nil {
		httpx.InternalError(w, h.log, "list residents", err)
		return
	}
	out := listResponse{Date: today.Time().Format(time.DateOnly), Residents: make([]residentView, 0, len(roster))}
	for _, member := range roster {
		name := member.Name
		reading := readings[member.ID]
		out.Residents = append(out.Residents, residentView{
			ID: member.ID, You: member.ID == m.ResidentID, Name: name,
			PhotoURL:   h.photoURL(member.PhotoKey),
			Initials:   users.Initials(name),
			AvatarTone: users.AvatarTone(member.UserID),
			Streak:     reading.Current,
			DoneToday:  reading.DoneToday,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
