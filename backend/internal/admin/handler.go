// Package admin is the read-only operator API behind the super-admin guard
// (ADR 0017). It reads with SQL only, imports no domain package, and returns
// aggregates and opaque counts: no email, name, user id or Chore title.
package admin

import (
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Handler serves the /admin routes of this package.
type Handler struct {
	store   *Store
	clock   clock.Clock
	log     *slog.Logger
	display Display
}

// Display is what GET /admin/ai shows from configuration. Neither value is
// enforced here: the Allocation job enforces the cap, and the Anthropic
// Console enforces the spend limit.
type Display struct {
	// DailyCapPerHome is LLM_DAILY_CAP_PER_HOME.
	DailyCapPerHome int
	// MonthlySpendLimitMicros is LLM_MONTHLY_SPEND_LIMIT_USD in micro-USD;
	// zero means none is configured.
	MonthlySpendLimitMicros int64
}

// NewHandler returns a Handler.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger, display Display) *Handler {
	return &Handler{store: store, clock: clk, log: log, display: display}
}

// AI answers GET /admin/ai?range=7d|30d, with the same range rules and error
// handling as Overview.
func (h *Handler) AI(w http.ResponseWriter, r *http.Request) {
	rng, err := ParseRange(r.URL.Query().Get("range"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid range")
		return
	}
	now := h.clock.Now()
	days := rng.Window(now)
	from, to := days[0], days[len(days)-1]

	ai, err := h.store.AI(r.Context(), from, to, now, h.log)
	if err != nil {
		httpx.InternalError(w, h.log, "admin ai", err)
		return
	}
	out := AIResponse{
		Range: rng.Name, From: from, To: to, CostIsEstimate: true,
		Days: make([]AIDay, len(days)),
		MonthToDate: MonthToDate{
			Month: now.UTC().Format("2006-01"), EstCostMicros: ai.MonthEstCostMicros, UncostedCalls: ai.MonthUncostedCalls,
		},
		DailyCapPerHome:    h.display.DailyCapPerHome,
		AllocatorShare:     ai.Allocator,
		ExplanationShare:   ai.Explanation,
		TopViolationKinds:  ai.Kinds,
		TopFallbackReasons: ai.Reasons,
	}
	if h.display.MonthlySpendLimitMicros > 0 {
		limit := h.display.MonthlySpendLimitMicros
		out.MonthToDate.LimitMicros = &limit
	}
	for i, d := range days {
		out.Days[i] = AIDay{Date: d, Services: ai.Days[d]}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Overview answers GET /admin/overview?range=7d|30d. `range` is required: a
// missing, empty or unknown value is 400 "invalid range", because the page
// always sends one. A store error, a statement timeout included, is logged and
// answered 500.
func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	rng, err := ParseRange(r.URL.Query().Get("range"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid range")
		return
	}
	days := rng.Window(h.clock.Now())
	from, to := days[0], days[len(days)-1]

	ov, err := h.store.Overview(r.Context(), from, to)
	if err != nil {
		httpx.InternalError(w, h.log, "admin overview", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, OverviewResponse{
		Range: rng.Name, From: from, To: to,
		Totals: ov.Totals, Active: ov.Active, Days: ZeroFill(days, ov.Days),
	})
}
