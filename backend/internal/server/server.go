// Package server builds the HTTP handler for the API.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
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
	// Push sends Web Push messages; nil means push is not configured and the
	// /push/* routes answer 503.
	Push push.Sender
	// VAPIDPublicKey is the application server key browsers subscribe with.
	VAPIDPublicKey string
	// Verifier checks the bearer token; nil means auth is not configured and
	// routes that need a signed-in User answer 503.
	Verifier auth.Verifier
}

const healthTimeout = 2 * time.Second

// New returns the API handler. It is a plain http.Handler so the Lambda
// adapter can wrap it unchanged.
func New(deps Deps) http.Handler {
	if deps.Logger == nil {
		deps.Logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}
	s := &server{
		deps:    deps,
		push:    push.NewStore(deps.DB),
		users:   users.NewStore(deps.DB),
		homes:   homes.NewStore(deps.DB),
		chores:  chores.NewStore(deps.DB),
		tasks:   tasks.NewStore(deps.DB),
		profile: profile.NewStore(deps.DB),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /me", s.requireUser(s.getMe))
	mux.HandleFunc("POST /home", s.requireUser(s.postHome))
	mux.HandleFunc("GET /home", s.requireResident(s.getHome))
	mux.HandleFunc("PUT /home", s.requireResident(s.putHome))
	mux.HandleFunc("GET /home/chores", s.requireResident(s.listChores))
	mux.HandleFunc("POST /home/chores", s.requireResident(s.postChore))
	mux.HandleFunc("PUT /home/chores/{id}", s.requireResident(s.putChore))
	mux.HandleFunc("DELETE /home/chores/{id}", s.requireResident(s.deleteChore))
	mux.HandleFunc("GET /home/tasks", s.requireResident(s.listTasks))
	mux.HandleFunc("GET /categories", s.requireUser(s.getCategories))
	mux.HandleFunc("GET /demands", s.requireUser(s.getDemands))
	mux.HandleFunc("GET /me/profile", s.requireUser(s.getProfile))
	mux.HandleFunc("PUT /me/baseline", s.requireUser(s.putBaseline))
	mux.HandleFunc("PUT /me/preferences/{category}", s.requireUser(s.putPreference))
	mux.HandleFunc("PUT /me/restrictions/{demand}", s.requireUser(s.putRestriction))
	mux.HandleFunc("DELETE /me/restrictions/{demand}", s.requireUser(s.deleteRestriction))
	mux.HandleFunc("GET /push/vapid-public-key", s.requirePush(s.vapidPublicKey))
	mux.HandleFunc("PUT /push/subscription", s.requirePush(s.requireUser(s.putPushSubscription)))
	mux.HandleFunc("POST /push/test", s.requirePush(s.requireUser(s.postPushTest)))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})

	return s.cors(s.recoverPanics(s.logRequests(mux)))
}

type server struct {
	deps  Deps
	push  *push.Store
	users *users.Store
	homes *homes.Store
	// chores is the Home's Chores.
	chores *chores.Store
	// tasks is the Home's Tasks and the open pool.
	tasks *tasks.Store
	// profile is the User's Baseline, Preferences and Restrictions.
	profile *profile.Store
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
