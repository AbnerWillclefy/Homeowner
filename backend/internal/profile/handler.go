package profile

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// maxProfileBody is far above any valid profile body; it only bounds abuse.
const maxProfileBody = 4 * 1024

// weekdayNames are the wire keys for the Baseline, in time.Weekday order
// (0 = Sunday, as in the database).
var weekdayNames = [...]string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}

// Handler serves the /me/profile, /me/baseline, /me/preferences and
// /me/restrictions routes.
type Handler struct {
	store *Store
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, log *slog.Logger) *Handler {
	return &Handler{store: store, log: log}
}

// Get answers GET /me/profile.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	p, err := h.store.Load(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "load profile", err)
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
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"baseline":     baseline,
		"preferences":  p.Preferences,
		"restrictions": restrictions,
	})
}

// SetBaseline sets or clears the Baseline of the weekdays in the body and
// leaves the others alone, so a stale screen cannot erase a day. A number sets
// the day, null clears it.
func (h *Handler) SetBaseline(w http.ResponseWriter, r *http.Request) {
	var body map[string]json.RawMessage
	if !httpx.DecodeBody(w, r, &body, maxProfileBody, true) {
		return
	}
	if len(body) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "baseline must name at least one weekday")
		return
	}
	set := map[time.Weekday]int{}
	var cleared []time.Weekday
	for key, raw := range body {
		day := slices.Index(weekdayNames[:], key)
		if day < 0 {
			httpx.WriteError(w, http.StatusBadRequest, fmt.Sprintf("%s is not a weekday; use sunday to saturday", key))
			return
		}
		if string(raw) == "null" {
			cleared = append(cleared, time.Weekday(day))
			continue
		}
		points, err := strconv.Atoi(string(raw))
		if err != nil || points < 0 || points > MaxBaseline {
			httpx.WriteError(w, http.StatusBadRequest, fmt.Sprintf("%s must be an integer from 0 to %d, or null to clear it", key, MaxBaseline))
			return
		}
		set[time.Weekday(day)] = points
	}
	if err := h.store.SetBaseline(r.Context(), identity.CurrentUser(r.Context()).ID, set, cleared); err != nil {
		httpx.InternalError(w, h.log, "set baseline", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SetPreference sets the signed-in User's Preference for a Category; neutral
// removes it. An unknown Category is a 404, not a 400: it is a path that does
// not exist.
func (h *Handler) SetPreference(w http.ResponseWriter, r *http.Request) {
	category := r.PathValue("category")
	if !vocab.IsCategory(category) {
		httpx.WriteError(w, http.StatusNotFound, "unknown category")
		return
	}
	var body struct {
		Preference string `json:"preference"`
	}
	if !httpx.DecodeBody(w, r, &body, maxProfileBody, true) {
		return
	}
	switch body.Preference {
	case Like, Neutral, Dislike:
	default:
		httpx.WriteError(w, http.StatusBadRequest, "preference must be one of like, neutral, dislike")
		return
	}
	if err := h.store.SetPreference(r.Context(), identity.CurrentUser(r.Context()).ID, category, body.Preference); err != nil {
		httpx.InternalError(w, h.log, "set preference", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AddRestriction answers PUT /me/restrictions/{demand}.
func (h *Handler) AddRestriction(w http.ResponseWriter, r *http.Request) {
	h.changeRestriction(w, r, h.store.AddRestriction, "add restriction")
}

// RemoveRestriction answers DELETE /me/restrictions/{demand}.
func (h *Handler) RemoveRestriction(w http.ResponseWriter, r *http.Request) {
	h.changeRestriction(w, r, h.store.RemoveRestriction, "remove restriction")
}

// changeRestriction is the shared shape of adding and removing a Restriction
// on the Demand in the path; both are idempotent.
func (h *Handler) changeRestriction(w http.ResponseWriter, r *http.Request, change func(ctx context.Context, userID, demand string) error, what string) {
	demand := r.PathValue("demand")
	if !vocab.IsDemand(demand) {
		httpx.WriteError(w, http.StatusNotFound, "unknown demand")
		return
	}
	if err := change(r.Context(), identity.CurrentUser(r.Context()).ID, demand); err != nil {
		httpx.InternalError(w, h.log, what, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
