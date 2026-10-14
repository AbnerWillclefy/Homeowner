package server

import (
	"net/http"
	"strings"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// loggedPath is the path as it may appear in a log line. An Invite token is a
// credential (anyone holding it can join a Home), so the token segment is
// replaced by its name; it is done on the path, not the matched pattern, so it
// also holds for requests that never reach the mux.
func loggedPath(path string) string {
	rest, ok := strings.CutPrefix(path, "/invites/")
	if !ok {
		return path
	}
	if _, after, found := strings.Cut(rest, "/"); found {
		return "/invites/{token}/" + after
	}
	return "/invites/{token}"
}

// logRequests writes one JSON log line per request. Its timestamp ("ts")
// comes from Deps.Clock, never from time.Now().
func (s *server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		s.deps.Logger.Info("request",
			"ts", s.deps.Clock.Now().UTC().Format(time.RFC3339),
			"method", r.Method,
			"path", loggedPath(r.URL.Path),
			"status", rec.status,
		)
	})
}

func (s *server) recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.deps.Logger.Error("panic recovered", "panic", v, "path", loggedPath(r.URL.Path))
				httpx.WriteError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
