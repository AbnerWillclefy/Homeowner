// Package server builds the HTTP handler for the API.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
)

// Deps is everything outside the system that tests need to fake. Tests build
// it through apitest, never with a literal, so adding a field does not touch
// existing tests.
type Deps struct {
	DB    *pgxpool.Pool
	Clock clock.Clock
	// Logger is optional; it defaults to JSON on stdout.
	Logger *slog.Logger
	// CORSAllowedOrigins are the browser origins allowed to call the API.
	// Empty means no CORS headers.
	CORSAllowedOrigins []string
}

const healthTimeout = 2 * time.Second

// New returns the API handler. It is a plain http.Handler so the Lambda
// adapter can wrap it unchanged.
func New(deps Deps) http.Handler {
	if deps.Logger == nil {
		deps.Logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}
	s := &server{deps: deps}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})

	return s.cors(s.recoverPanics(s.logRequests(mux)))
}

type server struct {
	deps Deps
}

func (s *server) healthz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
	defer cancel()
	if err := s.deps.DB.Ping(ctx); err != nil {
		s.deps.Logger.Error("health check: database ping failed", "error", err.Error())
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
