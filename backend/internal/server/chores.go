package server

import (
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

const maxChoreBody = 8 * 1024

// choreBody is the request body. Numbers are `any` so a wrong type becomes a
// field code from chores.Validate instead of a generic bad request.
type choreBody struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      any      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          any      `json:"people"`
	IntervalDays    any      `json:"intervalDays"`
	AllowedWeekdays []any    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

type choreResponse struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      int      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          int      `json:"people"`
	IntervalDays    *int     `json:"intervalDays"`
	AllowedWeekdays []int    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

func toChoreResponse(c chores.Chore) choreResponse {
	return choreResponse{
		ID: c.ID, Name: c.Name, Category: c.Category, Demands: c.Demands,
		BaseEffort: c.BaseEffort, Importance: c.Importance, People: c.People,
		IntervalDays: c.IntervalDays, AllowedWeekdays: c.AllowedWeekdays, BuildsUp: c.BuildsUp,
	}
}

// readChore decodes and validates the body, writing the error response itself
// when it is not acceptable.
func readChore(w http.ResponseWriter, r *http.Request) (chores.Fields, bool) {
	var b choreBody
	if !decodeBody(w, r, &b, maxChoreBody, true) {
		return chores.Fields{}, false
	}
	f, errs := chores.Validate(chores.Input{
		Name: b.Name, Category: b.Category, Demands: b.Demands, BaseEffort: b.BaseEffort,
		Importance: b.Importance, People: b.People, IntervalDays: b.IntervalDays,
		AllowedWeekdays: b.AllowedWeekdays, BuildsUp: b.BuildsUp,
	})
	if len(errs) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid chore", "fields": errs})
		return chores.Fields{}, false
	}
	return f, true
}

func (s *server) choreFailed(w http.ResponseWriter, err error, what string) {
	if errors.Is(err, chores.ErrNotFound) {
		writeError(w, http.StatusNotFound, "chore not found")
		return
	}
	s.deps.Logger.Error(what, "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (s *server) listChores(w http.ResponseWriter, r *http.Request) {
	cs, err := s.chores.List(r.Context(), currentHome(r.Context()).ID)
	if err != nil {
		s.choreFailed(w, err, "list chores")
		return
	}
	out := make([]choreResponse, len(cs))
	for i, c := range cs {
		out[i] = toChoreResponse(c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"chores": out})
}

func (s *server) postChore(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	c, err := s.chores.Create(r.Context(), currentHome(r.Context()).ID, f, s.deps.Clock.Now())
	if err != nil {
		s.choreFailed(w, err, "create chore")
		return
	}
	writeJSON(w, http.StatusCreated, toChoreResponse(c))
}

func (s *server) putChore(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	c, err := s.chores.Update(r.Context(), currentHome(r.Context()).ID, r.PathValue("id"), f, s.deps.Clock.Now())
	if err != nil {
		s.choreFailed(w, err, "update chore")
		return
	}
	writeJSON(w, http.StatusOK, toChoreResponse(c))
}

func (s *server) deleteChore(w http.ResponseWriter, r *http.Request) {
	if err := s.chores.Delete(r.Context(), currentHome(r.Context()).ID, r.PathValue("id")); err != nil {
		s.choreFailed(w, err, "delete chore")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
