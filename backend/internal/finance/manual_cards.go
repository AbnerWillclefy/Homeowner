package finance

import (
	"net/http"
	"strings"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// manualMonths is how many months a manual card's bill can be typed for, from the current one.
const manualMonths = 12

func manualCardResponse(c ManualCard) ManualCardResponse {
	bills := make(map[string]int64, len(c.Bills))
	for _, b := range c.Bills {
		bills[b.Month.Format("2006-01")] = b.TotalCents
	}
	return ManualCardResponse{ID: c.ID, Name: c.Name, DueDay: c.DueDay, PixRecipient: c.PixRecipient, Bills: bills}
}

// ListManualCards answers GET /me/finance/manual-cards, ordered by name.
func (h *Handler) ListManualCards(w http.ResponseWriter, r *http.Request) {
	cards, err := h.store.ManualCards(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: list manual cards", err)
		return
	}
	out := make([]ManualCardResponse, len(cards))
	for i, c := range cards {
		out[i] = manualCardResponse(c)
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"cards": out})
}

// CreateManualCard answers POST /me/finance/manual-cards.
func (h *Handler) CreateManualCard(w http.ResponseWriter, r *http.Request) {
	in, ok := h.manualCardBody(w, r)
	if !ok {
		return
	}
	c, _, err := h.store.SaveManualCard(r.Context(), identity.CurrentUser(r.Context()).ID, "", in, h.clk.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "finance: create manual card", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, manualCardResponse(c))
}

// UpdateManualCard answers PUT /me/finance/manual-cards/{id}. A malformed id and
// another User's card both answer 404.
func (h *Handler) UpdateManualCard(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	in, ok := h.manualCardBody(w, r)
	if !ok {
		return
	}
	c, found, err := h.store.SaveManualCard(r.Context(), identity.CurrentUser(r.Context()).ID, id, in, h.clk.Now())
	h.answer(w, found, err, "update manual card", func() { httpx.WriteJSON(w, http.StatusOK, manualCardResponse(c)) })
}

// DeleteManualCard answers DELETE /me/finance/manual-cards/{id}; its bills go with it.
func (h *Handler) DeleteManualCard(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, err := h.store.DeleteManualCard(r.Context(), identity.CurrentUser(r.Context()).ID, id)
	h.answer(w, found, err, "delete manual card", func() { w.WriteHeader(http.StatusNoContent) })
}

// manualCardBody decodes and validates a manual card body; on failure it has answered.
func (h *Handler) manualCardBody(w http.ResponseWriter, r *http.Request) (ManualCardInput, bool) {
	var req ManualCardRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return ManualCardInput{}, false
	}
	in := ManualCardInput{DueDay: req.DueDay, Bills: map[time.Time]*int64{}}
	fields := map[string]string{}
	var code string
	if in.Name, code = nameField(req.Name); code != "" {
		fields["name"] = code
	}
	if req.DueDay < 1 || req.DueDay > 31 {
		fields["dueDay"] = "invalid"
	}
	if req.PixRecipient != nil && strings.TrimSpace(*req.PixRecipient) != "" {
		var name string
		if name, code = nameField(*req.PixRecipient); code != "" {
			fields["pixRecipient"] = code
		}
		in.PixRecipient = &name
	}
	first := postedOn(h.clk.Now())
	first = time.Date(first.Year(), first.Month(), 1, 0, 0, 0, 0, time.UTC)
	for key, cents := range req.Bills {
		month, _, ok := parseMonth(key)
		if !ok || month.Before(first) || !month.Before(first.AddDate(0, manualMonths, 0)) {
			fields["bills"] = "invalid_month"
			break
		}
		if cents != nil && (*cents < 0 || *cents > maxBillCents) {
			fields["bills"] = "invalid"
		}
		in.Bills[month] = cents
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid manual card", "fields": fields})
		return in, false
	}
	return in, true
}
