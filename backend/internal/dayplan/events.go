package dayplan

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
)

const maxEventBody = 64 * 1024

// EventsHandler is the whole HTTP surface of the Allocation job's Lambda.
// Lambda Web Adapter forwards any event that is not an HTTP request to
// POST /events on the server, so this is how the EventBridge schedule reaches
// Go (docs/adr/0008). The function has no URL and no gateway: only EventBridge
// may invoke it (lambda permission), so nothing on the internet can reach this
// handler, and it serves nothing but the tick and a readiness check.
//
// The body must be an EventBridge scheduled event. That is a sanity check, not
// authentication: it stops a stray test invocation from running the job by
// accident.
func EventsHandler(p *Planner, clk clock.Clock, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("POST /events", func(w http.ResponseWriter, r *http.Request) {
		var ev struct {
			Source     string `json:"source"`
			DetailType string `json:"detail-type"`
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxEventBody))
		if err != nil || json.Unmarshal(body, &ev) != nil || ev.Source != "aws.events" || ev.DetailType != "Scheduled Event" {
			log.Warn("ignored an event that is not a scheduled event")
			http.Error(w, "not a scheduled event", http.StatusBadRequest)
			return
		}
		sum, err := p.RunDue(r.Context(), clk.Now())
		if err != nil {
			log.Error("allocation tick failed", "error", err.Error())
			http.Error(w, "allocation tick failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(sum)
	})
	return mux
}
