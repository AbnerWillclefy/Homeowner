package finance

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBillName  = 60
	maxBillCents = 1_000_000_000_000
)

// CreateBill answers POST /me/finance/bills.
func (h *Handler) CreateBill(w http.ResponseWriter, r *http.Request) {
	req, ok := h.billBody(w, r)
	if !ok {
		return
	}
	b, err := h.store.CreateBill(r.Context(), identity.CurrentUser(r.Context()).ID, req, h.clk.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "finance: create bill", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, b)
}

// UpdateBill answers PUT /me/finance/bills/{id}. A malformed id and another
// User's Bill both answer 404.
func (h *Handler) UpdateBill(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	req, ok := h.billBody(w, r)
	if !ok {
		return
	}
	b, found, err := h.store.UpdateBill(r.Context(), identity.CurrentUser(r.Context()).ID, id, req, h.clk.Now())
	h.answer(w, found, err, "update bill", func() { httpx.WriteJSON(w, http.StatusOK, b) })
}

// DeleteBill answers DELETE /me/finance/bills/{id}; its payments go with it.
func (h *Handler) DeleteBill(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, err := h.store.DeleteBill(r.Context(), identity.CurrentUser(r.Context()).ID, id)
	h.answer(w, found, err, "delete bill", func() { w.WriteHeader(http.StatusNoContent) })
}

// ListBills answers GET /me/finance/bills?month=YYYY-MM: every Bill with its
// due date in that month and whether the month is paid.
func (h *Handler) ListBills(w http.ResponseWriter, r *http.Request) {
	from, _, ok := parseMonth(r.URL.Query().Get("month"))
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid month")
		return
	}
	bills, err := h.store.MonthBills(r.Context(), identity.CurrentUser(r.Context()).ID, from)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: list bills", err)
		return
	}
	for i := range bills {
		bills[i].DueDate = DueDate(from.Year(), from.Month(), bills[i].DueDay).Format(time.DateOnly)
	}
	httpx.WriteJSON(w, http.StatusOK, bills)
}

// PayBill answers PUT /me/finance/bills/{id}/payments/{month}: paid by hand.
func (h *Handler) PayBill(w http.ResponseWriter, r *http.Request) {
	h.payment(w, r, "pay bill", h.store.PayBillByHand)
}

// UnpayBill answers DELETE /me/finance/bills/{id}/payments/{month}.
func (h *Handler) UnpayBill(w http.ResponseWriter, r *http.Request) {
	h.payment(w, r, "unpay bill", h.store.UnpayBill)
}

func (h *Handler) payment(w http.ResponseWriter, r *http.Request, what string, do func(ctx context.Context, userID, id string, month, now time.Time) (bool, error)) {
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	month, _, ok := parseMonth(r.PathValue("month"))
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid month")
		return
	}
	found, err := do(r.Context(), identity.CurrentUser(r.Context()).ID, id, month, h.clk.Now())
	h.answer(w, found, err, what, func() { w.WriteHeader(http.StatusNoContent) })
}

// answer maps a store result to 500, 404 or the success write.
func (h *Handler) answer(w http.ResponseWriter, found bool, err error, what string, ok func()) {
	switch {
	case err != nil:
		httpx.InternalError(w, h.log, "finance: "+what, err)
	case !found:
		httpx.WriteError(w, http.StatusNotFound, "not found")
	default:
		ok()
	}
}

// billBody decodes and validates a Bill body; on failure it has answered.
func (h *Handler) billBody(w http.ResponseWriter, r *http.Request) (BillRequest, bool) {
	var req BillRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return req, false
	}
	req.Name = strings.TrimSpace(req.Name)
	fields := map[string]string{}
	switch n := utf8.RuneCountInString(req.Name); {
	case n == 0:
		fields["name"] = "required"
	case n > maxBillName:
		fields["name"] = "too_long"
	case strings.IndexFunc(req.Name, unicode.IsControl) >= 0:
		fields["name"] = "invalid"
	}
	if req.ExpectedCents < 1 || req.ExpectedCents > maxBillCents {
		fields["expectedCents"] = "invalid"
	}
	if req.DueDay < 1 || req.DueDay > 31 {
		fields["dueDay"] = "invalid"
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid bill", "fields": fields})
		return req, false
	}
	return req, true
}
