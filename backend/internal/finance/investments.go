package finance

import (
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const maxInvestmentName = 60

// InvestmentRequest is the body of POST /me/finance/investments and PUT /me/finance/investments/{id}.
// Serves is "reserve" or "goals".
type InvestmentRequest struct {
	Name       string `json:"name"`
	ValueCents int64  `json:"valueCents"`
	Serves     string `json:"serves"`
}

// InvestmentResponse is an Investment as created, updated or listed by GET /me/finance/savings.
// Serves is null while nothing is picked, which only a bank Investment can be.
// Source is "pluggy" or "hand"; ReportedByBank is omitted on a hand-typed one,
// and false on a bank one the bank stopped returning.
type InvestmentResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	ValueCents     int64   `json:"valueCents"`
	Serves         *string `json:"serves"`
	Source         string  `json:"source"`
	ReportedByBank *bool   `json:"reportedByBank,omitempty"`
}

// CreateInvestment answers POST /me/finance/investments.
func (h *Handler) CreateInvestment(w http.ResponseWriter, r *http.Request) {
	req, ok := h.investmentBody(w, r)
	if !ok {
		return
	}
	i, err := h.store.CreateInvestment(r.Context(), identity.CurrentUser(r.Context()).ID, req, h.clk.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "finance: create investment", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, i)
}

// UpdateInvestment answers PUT /me/finance/investments/{id}. A malformed id,
// another User's Investment and a bank Investment (see PutInvestmentServes) all answer 404.
func (h *Handler) UpdateInvestment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	req, ok := h.investmentBody(w, r)
	if !ok {
		return
	}
	i, found, err := h.store.UpdateInvestment(r.Context(), identity.CurrentUser(r.Context()).ID, id, req, h.clk.Now())
	h.answer(w, found, err, "update investment", func() { httpx.WriteJSON(w, http.StatusOK, i) })
}

// DeleteInvestment answers DELETE /me/finance/investments/{id}. A bank
// Investment answers 409: the next sync would bring it back.
func (h *Handler) DeleteInvestment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, bank, err := h.store.DeleteInvestment(r.Context(), identity.CurrentUser(r.Context()).ID, id)
	if err == nil && bank {
		httpx.WriteError(w, http.StatusConflict, "bank investment")
		return
	}
	h.answer(w, found, err, "delete investment", func() { w.WriteHeader(http.StatusNoContent) })
}

// PutInvestmentServes answers PUT /me/finance/investments/{id}/serves with
// {"serves": "reserve"|"goals"}: the pick of a bank Investment, which the User
// can change later. The value is never touched. A malformed id and another
// User's Investment answer 404.
func (h *Handler) PutInvestmentServes(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	var req struct {
		Serves string `json:"serves"`
	}
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if req.Serves != "reserve" && req.Serves != "goals" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid serves")
		return
	}
	found, err := h.store.SetInvestmentServes(r.Context(), identity.CurrentUser(r.Context()).ID, id, req.Serves, h.clk.Now())
	h.answer(w, found, err, "pick investment serves", func() { w.WriteHeader(http.StatusNoContent) })
}

// investmentBody decodes and validates an Investment body; on failure it has
// answered. A value of zero is valid: an Investment the User emptied but keeps.
func (h *Handler) investmentBody(w http.ResponseWriter, r *http.Request) (InvestmentRequest, bool) {
	var req InvestmentRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return req, false
	}
	req.Name = strings.TrimSpace(req.Name)
	fields := map[string]string{}
	switch n := utf8.RuneCountInString(req.Name); {
	case n == 0:
		fields["name"] = "required"
	case n > maxInvestmentName:
		fields["name"] = "too_long"
	case strings.IndexFunc(req.Name, unicode.IsControl) >= 0:
		fields["name"] = "invalid"
	}
	if req.ValueCents < 0 || req.ValueCents > maxIncomeCents {
		fields["valueCents"] = "invalid"
	}
	if req.Serves != "reserve" && req.Serves != "goals" {
		fields["serves"] = "invalid"
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid investment", "fields": fields})
		return req, false
	}
	return req, true
}
