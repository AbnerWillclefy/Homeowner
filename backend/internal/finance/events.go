package finance

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
)

const maxEventBody = 64 * 1024

// EventsHandler is the whole HTTP surface of the finance Lambda: a readiness
// check and the scheduled event that Lambda Web Adapter forwards to
// POST /events (docs/adr/0008). Like the Allocation job's, the body must be an
// EventBridge scheduled event: a sanity check, not authentication. A nil Syncer
// means Finances are not configured: the sync is skipped. The Reminders run
// after the sync in the same event; nil means no VAPID keys, so none are sent.
func EventsHandler(s *Syncer, rem *Reminders, clk clock.Clock, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("POST /events", func(w http.ResponseWriter, r *http.Request) {
		var ev struct {
			Source     string `json:"source"`
			DetailType string `json:"detail-type"`
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxEventBody))
		if err != nil || json.Unmarshal(body, &ev) != nil || ev.Source != "aws.events" || ev.DetailType != "Scheduled Event" {
			log.Warn("ignored an unrecognised event")
			http.Error(w, "unrecognised event", http.StatusBadRequest)
			return
		}
		var sum Summary
		var syncErr error
		if s == nil {
			log.Warn("finance sync disabled")
		} else {
			sum, syncErr = s.Run(r.Context(), clk.Now())
		}
		// Reminders run even when the sync failed: the Bills are already stored.
		if rem != nil {
			if err := rem.Run(r.Context(), clk.Now()); err != nil {
				log.Error("finance reminders failed", "error", safeErr(err))
			}
		}
		if s == nil {
			w.WriteHeader(http.StatusOK)
			return
		}
		if syncErr != nil {
			log.Error("finance sync failed", "error", safeErr(syncErr))
			http.Error(w, "finance sync failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(sum)
	})
	return mux
}
