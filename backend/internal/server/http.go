package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// decodeBody reads a JSON body of at most maxBytes into v and writes the
// error response itself when it fails. With strict set, a field v does not
// declare is an error, so a typo is not silently ignored.
func decodeBody(w http.ResponseWriter, r *http.Request, v any, maxBytes int64, strict bool) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	dec := json.NewDecoder(r.Body)
	if strict {
		dec.DisallowUnknownFields()
	}
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

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
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
