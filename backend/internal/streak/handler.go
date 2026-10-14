package streak

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// streakResponse is the caller's Streak on the Home's local date. Current is 0
// when there is none, never null. TodayGrew says today already counts.
type streakResponse struct {
	Date      string `json:"date"`
	Current   int    `json:"current"`
	TodayGrew bool   `json:"todayGrew"`
}

// Handler serves GET /home/streak.
type Handler struct {
	store *Store
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clock: clk, log: log}
}

// Get answers the caller's Streak. It only reads: it never plans.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	date, err := dayplan.LocalDate(m.Home.Timezone, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	current, grew, err := h.store.Current(r.Context(), m.ResidentID, date)
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, streakResponse{Date: date.Time().Format(time.DateOnly), Current: current, TodayGrew: grew})
}
