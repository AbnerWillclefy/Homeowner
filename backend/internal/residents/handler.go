package residents

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
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

// windowDays is how many local dates the detail covers: today and six before.
const windowDays = 7

// Get answers GET /home/residents/{id}: one Resident of the caller's Home with
// their Streak and the Completions of the last 7 local days, grouped by date.
// A malformed id is answered before any query, and every way of not finding
// the Resident (malformed, unknown, another Home, left) gives the same 404.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "resident not found")
		return
	}
	m := identity.CurrentMembership(r.Context())
	out, err := h.detail(r.Context(), m, id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "resident not found")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "get resident", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// detail gathers everything the detail shows for Resident id of the caller's Home.
func (h *Handler) detail(ctx context.Context, m identity.Membership, id string) (detailResponse, error) {
	member, err := h.store.Find(ctx, m.Home.ID, id)
	if err != nil {
		return detailResponse{}, err
	}
	today, err := dayplan.LocalDate(m.Home.Timezone, h.clock.Now())
	if err != nil {
		return detailResponse{}, err
	}
	readings, err := h.streaks.CurrentFor(ctx, []string{id}, today)
	if err != nil {
		return detailResponse{}, err
	}
	done, err := h.store.CompletionsBetween(ctx, m.Home.ID, id, (today - (windowDays - 1)).Time(), today.Time())
	if err != nil {
		return detailResponse{}, err
	}
	return detailResponse{
		Date: today.Time().Format(time.DateOnly), ID: member.ID, You: member.ID == m.ResidentID,
		Name: member.Name, PhotoURL: h.photoURL(member.PhotoKey),
		Initials:      users.Initials(member.Name),
		AvatarTone:    users.AvatarTone(member.UserID),
		Streak:        readings[id].Current,
		DoneLast7Days: len(done),
		Days:          groupByDay(done),
	}, nil
}

// groupByDay groups Completions by local date. The rows arrive newest date
// first, so a new group starts whenever the date changes.
func groupByDay(done []Completion) []dayView {
	days := []dayView{}
	for _, k := range done {
		date := k.CompletedOn.Format(time.DateOnly)
		if n := len(days); n == 0 || days[n-1].Date != date {
			days = append(days, dayView{Date: date, Completions: []completionView{}})
		}
		with := make([]partnerView, 0, len(k.With))
		for _, p := range k.With {
			with = append(with, partnerView{ID: p.ID, Name: p.Name})
		}
		day := &days[len(days)-1]
		day.Completions = append(day.Completions, completionView{
			ID: k.ID, ChoreID: k.ChoreID, ChoreName: k.ChoreName, Category: k.Category,
			CompletedAt: k.CompletedAt.UTC().Format(time.RFC3339), With: with,
		})
	}
	return days
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
