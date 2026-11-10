package finance

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxGoalName  = 60
	maxGoalCents = 1_000_000_000_000
	maxGoalIDs   = 1000
)

// CreateGoal answers POST /me/finance/goals: the new Goal goes last in the order.
func (h *Handler) CreateGoal(w http.ResponseWriter, r *http.Request) {
	g, ok := h.goalBody(w, r)
	if !ok {
		return
	}
	out, err := h.store.CreateGoal(r.Context(), identity.CurrentUser(r.Context()).ID, g, h.clk.Now())
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		httpx.WriteError(w, http.StatusConflict, "try again")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "finance: create goal", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, out)
}

// UpdateGoal answers PUT /me/finance/goals/{id}. A malformed id and another
// User's Goal both answer 404.
func (h *Handler) UpdateGoal(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	g, ok := h.goalBody(w, r)
	if !ok {
		return
	}
	out, found, err := h.store.UpdateGoal(r.Context(), identity.CurrentUser(r.Context()).ID, id, g, h.clk.Now())
	h.answer(w, found, err, "update goal", func() { httpx.WriteJSON(w, http.StatusOK, out) })
}

// DeleteGoal answers DELETE /me/finance/goals/{id}. The gap it leaves in the
// positions is closed by the next reorder.
func (h *Handler) DeleteGoal(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, err := h.store.DeleteGoal(r.Context(), identity.CurrentUser(r.Context()).ID, id)
	h.answer(w, found, err, "delete goal", func() { w.WriteHeader(http.StatusNoContent) })
}

// ReorderGoals answers PUT /me/finance/goals/order: the ids must be exactly the
// User's Goals, once each, or nothing changes and it answers 400.
func (h *Handler) ReorderGoals(w http.ResponseWriter, r *http.Request) {
	var req GoalOrderRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes*8, true) {
		return
	}
	if req.IDs == nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid order")
		return
	}
	same, err := h.store.ReorderGoals(r.Context(), identity.CurrentUser(r.Context()).ID, req.IDs, h.clk.Now())
	switch {
	case err != nil:
		httpx.InternalError(w, h.log, "finance: reorder goals", err)
	case !same:
		httpx.WriteError(w, http.StatusBadRequest, "ids must be exactly your goals, once each")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// goalBody decodes and validates a Goal body; on failure it has answered.
func (h *Handler) goalBody(w http.ResponseWriter, r *http.Request) (GoalInput, bool) {
	var req GoalRequest
	var g GoalInput
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return g, false
	}
	g.Name = strings.TrimSpace(req.Name)
	fields := map[string]string{}
	switch n := utf8.RuneCountInString(g.Name); {
	case n == 0:
		fields["name"] = "required"
	case n > maxGoalName:
		fields["name"] = "too_long"
	case strings.IndexFunc(g.Name, unicode.IsControl) >= 0:
		fields["name"] = "invalid"
	}
	// Parsed from the raw token so 1.5, 1e3, "9" and null are all refused with the field named.
	var err error
	if g.TargetCents, err = strconv.ParseInt(string(req.TargetCents), 10, 64); err != nil || g.TargetCents < 1 || g.TargetCents > maxGoalCents {
		fields["targetCents"] = "invalid"
	}
	if req.TargetMonth != nil {
		month, _, ok := parseMonth(*req.TargetMonth)
		if !ok {
			fields["targetMonth"] = "invalid"
		}
		g.TargetMonth = &month
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid goal", "fields": fields})
		return g, false
	}
	return g, true
}
