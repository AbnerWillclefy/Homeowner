package server

import (
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

const maxChoreBody = 8 * 1024

// readChore decodes and validates the body, writing the error response itself
// when it is not acceptable.
func readChore(w http.ResponseWriter, r *http.Request) (chores.Fields, bool) {
	var in chores.Input
	if !decodeBody(w, r, &in, maxChoreBody, true) {
		return chores.Fields{}, false
	}
	f, errs := chores.Validate(in)
	if len(errs) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid chore", "fields": errs})
		return chores.Fields{}, false
	}
	return f, true
}

// choreFailed answers a Store error: not found, or an internal error.
func (s *server) choreFailed(w http.ResponseWriter, err error) {
	if errors.Is(err, chores.ErrNotFound) {
		writeError(w, http.StatusNotFound, "chore not found")
		return
	}
	s.internalError(w, err)
}

func (s *server) internalError(w http.ResponseWriter, err error) {
	s.deps.Logger.Error("chores", "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (s *server) listChores(w http.ResponseWriter, r *http.Request) {
	cs, err := s.chores.List(r.Context(), currentHome(r.Context()).ID)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"chores": cs})
}

func (s *server) postChore(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	c, err := s.chores.Create(r.Context(), currentHome(r.Context()).ID, f, s.deps.Clock.Now())
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (s *server) putChore(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		writeError(w, http.StatusNotFound, "chore not found")
		return
	}
	c, err := s.chores.Update(r.Context(), currentHome(r.Context()).ID, id, f, s.deps.Clock.Now())
	if err != nil {
		s.choreFailed(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *server) deleteChore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		writeError(w, http.StatusNotFound, "chore not found")
		return
	}
	if err := s.chores.Delete(r.Context(), currentHome(r.Context()).ID, id); err != nil {
		s.choreFailed(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
