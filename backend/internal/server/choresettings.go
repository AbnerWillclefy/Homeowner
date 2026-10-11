package server

import (
	"context"
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/choresettings"
)

// choreFromPath returns the Chore id of the path. A malformed id cannot name a
// Chore, so it is the same 404 as an unknown one, before the Store is asked.
func choreFromPath(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		writeError(w, http.StatusNotFound, "chore not found")
		return "", false
	}
	return id, true
}

type settingWrite func(ctx context.Context, homeID, residentID, choreID string) error

// changeSetting runs a write (with any body already read) on the caller's own
// Resident and the Chore of the path. The Resident is never named by the
// request, so nobody can set another Resident's settings.
func (s *server) changeSetting(w http.ResponseWriter, r *http.Request, do settingWrite) {
	id, ok := choreFromPath(w, r)
	if !ok {
		return
	}
	m := currentMembership(r.Context())
	if err := do(r.Context(), m.Home.ID, m.ResidentID, id); err != nil {
		s.settingFailed(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) settingFailed(w http.ResponseWriter, err error) {
	if errors.Is(err, choresettings.ErrNotFound) {
		writeError(w, http.StatusNotFound, "chore not found")
		return
	}
	s.internalError(w, err)
}

func (s *server) putChorePreference(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Preference string `json:"preference"`
	}
	if !decodeBody(w, r, &body, maxProfileBody, true) {
		return
	}
	if !choresettings.ValidPreference(body.Preference) {
		writeError(w, http.StatusBadRequest, "preference must be one of like, neutral, dislike")
		return
	}
	s.changeSetting(w, r, func(ctx context.Context, homeID, residentID, choreID string) error {
		return s.choreSettings.SetPreference(ctx, homeID, residentID, choreID, body.Preference)
	})
}

func (s *server) deleteChorePreference(w http.ResponseWriter, r *http.Request) {
	s.changeSetting(w, r, s.choreSettings.ClearPreference)
}

func (s *server) putChoreRestriction(w http.ResponseWriter, r *http.Request) {
	s.changeSetting(w, r, s.choreSettings.AddRestriction)
}

func (s *server) deleteChoreRestriction(w http.ResponseWriter, r *http.Request) {
	s.changeSetting(w, r, s.choreSettings.RemoveRestriction)
}

type effectiveResponse struct {
	Preference        string   `json:"preference"`
	Source            string   `json:"source"`
	Restricted        bool     `json:"restricted"`
	RestrictedBy      []string `json:"restrictedBy"`
	RestrictedByChore bool     `json:"restrictedByChore"`
}

type residentSettingsResponse struct {
	ID     string                       `json:"id"`
	You    bool                         `json:"you"`
	Chores map[string]effectiveResponse `json:"chores"`
}

// getChoreSettings returns every Resident's effective Preference and
// Restrictions per Chore for the caller's Home. Residents are labelled by id
// and a "you" flag; names wait for the Invite work.
func (s *server) getChoreSettings(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	view, err := s.choreSettings.Effective(r.Context(), m.Home.ID)
	if err != nil {
		s.internalError(w, err)
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
	writeJSON(w, http.StatusOK, map[string]any{"residents": out})
}
