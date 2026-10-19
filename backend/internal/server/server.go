// Package server builds the HTTP handler for the API.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/catalog"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/choresettings"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/invites"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/replan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/streak"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
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
	// Allocator plans a Resident again when they check in after the Day Plan
	// was made; nil means allocation.Baseline. It must be the Allocator the
	// scheduled job uses.
	Allocator allocation.Allocator
	// Replanner asks the Allocation function to plan one Home again; nil means
	// the staging-only POST /dev/replan route does not exist (404), as in
	// production.
	Replanner replan.Replanner
}

const healthTimeout = 2 * time.Second

// New returns the API handler. It is a plain http.Handler so the Lambda
// adapter can wrap it unchanged. Every route is listed here, each served by
// its domain's Handler behind the access check it needs.
func New(deps Deps) http.Handler {
	if deps.Logger == nil {
		deps.Logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}
	if deps.Allocator == nil {
		deps.Allocator = allocation.Baseline{}
	}
	db, clk, log := deps.DB, deps.Clock, deps.Logger
	homeStore := homes.NewStore(db)
	s := &server{deps: deps, users: users.NewStore(db), homes: homeStore}

	me := users.NewHandler(s.users, homeStore, clk, log)
	home := homes.NewHandler(homeStore, clk, log)
	invite := invites.NewHandler(invites.NewStore(db), clk, log)
	chore := chores.NewHandler(chores.NewStore(db), clk, log)
	choreSettings := choresettings.NewHandler(choresettings.NewStore(db), log)
	task := tasks.NewHandler(tasks.NewStore(db), clk, log)
	dayPlan := dayplan.NewHandler(dayplan.New(db, deps.Allocator, log), dayplan.NewStore(db), checkin.NewStore(db), clk, log)
	prof := profile.NewHandler(profile.NewStore(db), log)
	streaks := streak.NewHandler(streak.NewStore(db), clk, log)
	pushes := push.NewHandler(push.NewStore(db), deps.Push, deps.VAPIDPublicKey, clk, log)

	user, resident := s.requireUser, s.requireResident
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /me", user(me.Me))
	mux.HandleFunc("PUT /me/name", user(me.SetName))
	mux.HandleFunc("GET /me/onboarding", user(me.Onboarding))
	mux.HandleFunc("PUT /me/onboarding", user(me.AdvanceOnboarding))
	mux.HandleFunc("POST /home", user(home.Create))
	mux.HandleFunc("GET /home", resident(home.Get))
	mux.HandleFunc("GET /home/residents", resident(home.Residents))
	mux.HandleFunc("PUT /home", resident(home.Update))
	mux.HandleFunc("DELETE /home/residents/me", resident(home.Leave))
	mux.HandleFunc("GET /home/chores", resident(chore.List))
	mux.HandleFunc("POST /home/chores", resident(chore.Create))
	mux.HandleFunc("PUT /home/chores/{id}", resident(chore.Update))
	mux.HandleFunc("DELETE /home/chores/{id}", resident(chore.Delete))
	mux.HandleFunc("GET /home/chores/settings", resident(choreSettings.Get))
	mux.HandleFunc("PUT /home/chores/{id}/preference", resident(choreSettings.SetPreference))
	mux.HandleFunc("DELETE /home/chores/{id}/preference", resident(choreSettings.ClearPreference))
	mux.HandleFunc("PUT /home/chores/{id}/restriction", resident(choreSettings.AddRestriction))
	mux.HandleFunc("DELETE /home/chores/{id}/restriction", resident(choreSettings.RemoveRestriction))
	mux.HandleFunc("POST /home/invites", resident(invite.Create))
	mux.HandleFunc("GET /invites/{token}", invite.Lookup)
	mux.HandleFunc("POST /invites/{token}/accept", user(invite.Accept))
	mux.HandleFunc("GET /home/tasks", resident(task.List))
	mux.HandleFunc("GET /home/day-plan", resident(dayPlan.Get))
	mux.HandleFunc("POST /home/day-plan/me", resident(dayPlan.PlanMe))
	mux.HandleFunc("POST /home/tasks/{id}/accept", resident(dayPlan.Accept))
	mux.HandleFunc("POST /home/tasks/{id}/refuse", resident(dayPlan.Refuse))
	mux.HandleFunc("POST /home/tasks/{id}/take", resident(dayPlan.Take))
	mux.HandleFunc("POST /home/tasks/{id}/complete", resident(dayPlan.Complete))
	mux.HandleFunc("POST /home/day-plan/accept-all", resident(dayPlan.AcceptAll))
	mux.HandleFunc("POST /home/swaps", resident(dayPlan.OfferSwap))
	mux.HandleFunc("POST /home/swaps/{id}/accept", resident(dayPlan.AcceptSwap))
	mux.HandleFunc("POST /home/swaps/{id}/decline", resident(dayPlan.DeclineSwap))
	mux.HandleFunc("POST /home/swaps/{id}/cancel", resident(dayPlan.CancelSwap))
	mux.HandleFunc("GET /home/check-in", resident(dayPlan.GetCheckIn))
	mux.HandleFunc("PUT /home/check-in", resident(dayPlan.PutCheckIn))
	mux.HandleFunc("GET /home/streak", resident(streaks.Get))
	mux.HandleFunc("GET /categories", user(vocab.ServeCategories))
	mux.HandleFunc("GET /demands", user(vocab.ServeDemands))
	mux.HandleFunc("GET /catalog", user(catalog.ServeEntries))
	mux.HandleFunc("POST /catalog/proposals", user(catalog.ServeProposals))
	mux.HandleFunc("GET /me/profile", user(prof.Get))
	mux.HandleFunc("PUT /me/baseline", user(prof.SetBaseline))
	mux.HandleFunc("PUT /me/preferences/{category}", user(prof.SetPreference))
	mux.HandleFunc("PUT /me/restrictions/{demand}", user(prof.AddRestriction))
	mux.HandleFunc("DELETE /me/restrictions/{demand}", user(prof.RemoveRestriction))
	mux.HandleFunc("GET /push/vapid-public-key", pushes.RequireConfigured(pushes.PublicKey))
	mux.HandleFunc("PUT /push/subscription", pushes.RequireConfigured(user(pushes.PutSubscription)))
	mux.HandleFunc("POST /push/test", pushes.RequireConfigured(user(pushes.SendTest)))
	if deps.Replanner != nil {
		mux.HandleFunc("POST /dev/replan", resident(replan.NewHandler(deps.Replanner, log).Replan))
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
	})

	return s.cors(s.recoverPanics(s.logRequests(mux)))
}

// server holds what the middleware needs: the Deps, and the stores that find
// the caller's User and Home.
type server struct {
	deps  Deps
	users *users.Store
	homes *homes.Store
}

func (s *server) healthz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
	defer cancel()
	if err := s.deps.DB.Ping(ctx); err != nil {
		s.deps.Logger.Error("health check: database ping failed", "error", err.Error())
		httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
