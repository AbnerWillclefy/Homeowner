package choresettings

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// maxPreferenceBody is far above any valid body; it only bounds abuse.
const maxPreferenceBody = 4 * 1024

// Handler serves the /home/chores/settings and per-Chore setting routes.
type Handler struct {
	store *Store
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, log *slog.Logger) *Handler {
	return &Handler{store: store, log: log}
}

// choreFromPath returns the Chore id of the path. A malformed id cannot name a
// Chore, so it is the same 404 as an unknown one, before the Store is asked.
func choreFromPath(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "chore not found")
		return "", false
	}
	return id, true
}

type settingWrite func(ctx context.Context, homeID, residentID, choreID string) error

// change runs a write (with any body already read) on the caller's own
// Resident and the Chore of the path. The Resident is never named by the
// request, so nobody can set another Resident's settings.
func (h *Handler) change(w http.ResponseWriter, r *http.Request, do settingWrite) {
	id, ok := choreFromPath(w, r)
	if !ok {
		return
	}
	m := identity.CurrentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		h.failed(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) failed(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "chore not found")
		return
	}
	httpx.InternalError(w, h.log, "chores", err)
}

// SetPreference answers PUT /home/chores/{id}/preference.
func (h *Handler) SetPreference(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Preference string `json:"preference"`
	}
	if !httpx.DecodeBody(w, r, &body, maxPreferenceBody, true) {
		return
	}
	if !ValidPreference(body.Preference) {
		httpx.WriteError(w, http.StatusBadRequest, "preference must be one of like, neutral, dislike")
		return
	}
	h.change(w, r, func(ctx context.Context, homeID, residentID, choreID string) error {
		return h.store.SetPreference(ctx, homeID, residentID, choreID, body.Preference)
	})
}

// ClearPreference answers DELETE /home/chores/{id}/preference.
func (h *Handler) ClearPreference(w http.ResponseWriter, r *http.Request) {
	h.change(w, r, h.store.ClearPreference)
}

// AddRestriction answers PUT /home/chores/{id}/restriction.
func (h *Handler) AddRestriction(w http.ResponseWriter, r *http.Request) {
	h.change(w, r, h.store.AddRestriction)
}

// RemoveRestriction answers DELETE /home/chores/{id}/restriction.
func (h *Handler) RemoveRestriction(w http.ResponseWriter, r *http.Request) {
	h.change(w, r, h.store.RemoveRestriction)
}

// Get returns every Resident's effective Preference and Restrictions per Chore
// for the caller's Home. Residents are labelled by id and a "you" flag; names
// wait for the Invite work.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	view, err := h.store.Effective(r.Context(), m.Home.ID)
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	out := make([]residentSettingsResponse, 0, len(view))
	for _, rv := range view {
		chores := make(map[string]effectiveResponse, len(rv.Chores))
		for id, e := range rv.Chores {
			chores[id] = effectiveResponse(e)
		}
		out = append(out, residentSettingsResponse{ID: rv.ResidentID, You: rv.ResidentID == m.ResidentID, Chores: chores})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"residents": out})
}
