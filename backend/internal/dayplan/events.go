package dayplan

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
)

const maxEventBody = 64 * 1024

// The replan event, an EventBridge-shaped object so the handler decodes it like
// the scheduled one. The manual workflow .github/workflows/replan-staging.yml
// sends it, building the payload with jq; replan_event_json_test.go pins
// NewReplanEvent to that same JSON, so the two sides cannot drift.
const (
	ReplanSource     = "homeowner.dev"
	ReplanDetailType = "Replan Home"
)

// ReplanEvent is the event that asks the Allocation function to replan one Home.
type ReplanEvent struct {
	Source     string       `json:"source"`
	DetailType string       `json:"detail-type"`
	Detail     ReplanDetail `json:"detail"`
}

// ReplanDetail names the Home to replan.
type ReplanDetail struct {
	HomeID string `json:"homeId"`
}

// NewReplanEvent is the event that replans the Home.
func NewReplanEvent(homeID string) ReplanEvent {
	return ReplanEvent{Source: ReplanSource, DetailType: ReplanDetailType, Detail: ReplanDetail{HomeID: homeID}}
}

// EventsOption adjusts the handler built by EventsHandler.
type EventsOption func(*eventsConfig)

type eventsConfig struct{ replan bool }

// WithReplan makes the handler accept the replan event. Without it the event
// is refused like any unknown one; only staging switches it on
// (REPLAN_ENABLED).
func WithReplan() EventsOption {
	return func(c *eventsConfig) { c.replan = true }
}

// EventsHandler is the whole HTTP surface of the Allocation job's Lambda.
// Lambda Web Adapter forwards any event that is not an HTTP request to
// POST /events on the server, so this is how the EventBridge schedule reaches
// Go (docs/adr/0008). The function has no URL and no gateway: only EventBridge
// and the identities allowed to invoke it may reach this handler, and it serves
// nothing but the tick, the staging-only replan (WithReplan) and a readiness
// check.
//
// The body must be an EventBridge scheduled event, or the replan event when
// replan is on. That is a sanity check, not authentication: it stops a stray
// test invocation from running the job by accident.
func EventsHandler(p *Planner, clk clock.Clock, log *slog.Logger, opts ...EventsOption) http.Handler {
	var cfg eventsConfig
	for _, opt := range opts {
		opt(&cfg)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("POST /events", func(w http.ResponseWriter, r *http.Request) {
		var ev ReplanEvent
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxEventBody))
		if err != nil || json.Unmarshal(body, &ev) != nil {
			unrecognised(w, log)
			return
		}
		switch {
		case ev.Source == "aws.events" && ev.DetailType == "Scheduled Event":
			tick(w, r, p, clk, log)
		case cfg.replan && ev.Source == ReplanSource && ev.DetailType == ReplanDetailType:
			replan(w, r, p, clk, log, ev.Detail.HomeID)
		default:
			unrecognised(w, log)
		}
	})
	return mux
}

func unrecognised(w http.ResponseWriter, log *slog.Logger) {
	log.Warn("ignored an unrecognised event")
	http.Error(w, "unrecognised event", http.StatusBadRequest)
}

func tick(w http.ResponseWriter, r *http.Request, p *Planner, clk clock.Clock, log *slog.Logger) {
	sum, err := p.RunDue(r.Context(), clk.Now())
	if err != nil {
		log.Error("allocation tick failed", "error", err.Error())
		http.Error(w, "allocation tick failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(sum)
}

// replan answers the replan event. The workflow invokes synchronously and reads
// the status and body, so the run fails with these texts; the log line records
// it too.
func replan(w http.ResponseWriter, r *http.Request, p *Planner, clk clock.Clock, log *slog.Logger, homeID string) {
	if !chores.ValidID(homeID) {
		log.Warn("ignored a replan event with a bad home id")
		http.Error(w, "bad home id", http.StatusBadRequest)
		return
	}
	outcome, err := p.ReplanHome(r.Context(), homeID, clk.Now())
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		log.Warn("replan failed: no such home", "home", homeID)
		http.Error(w, "no such home", http.StatusNotFound)
	case err != nil:
		log.Error("replan failed", "home", homeID, "error", err.Error())
		http.Error(w, "replan failed", http.StatusInternalServerError)
	default:
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"outcome": string(outcome)})
	}
}
