package server

import "net/http"

// listTasks answers the Home's open pool. It first brings the Home's Tasks up
// to date for today in the Home's zone, so Residents never see a stale pool.
func (s *server) listTasks(w http.ResponseWriter, r *http.Request) {
	home := currentHome(r.Context()).ID
	if err := s.tasks.Refresh(r.Context(), home, s.deps.Clock.Now()); err != nil {
		s.internalError(w, err)
		return
	}
	open, err := s.tasks.ListOpen(r.Context(), home)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": open})
}
