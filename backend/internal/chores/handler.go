package chores

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const maxChoreBody = 8 * 1024

// Handler serves the /home/chores routes.
type Handler struct {
	store *Store
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clock: clk, log: log}
}

// readChore decodes and validates the body, writing the error response itself
// when it is not acceptable.
func readChore(w http.ResponseWriter, r *http.Request) (Fields, bool) {
	var in Input
	if !httpx.DecodeBody(w, r, &in, maxChoreBody, true) {
		return Fields{}, false
	}
	f, errs := Validate(in)
	if len(errs) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid chore", "fields": errs})
		return Fields{}, false
	}
	return f, true
}

// failed answers a Store error: not found, or an internal error.
func (h *Handler) failed(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "chore not found")
		return
	}
	httpx.InternalError(w, h.log, "chores", err)
}

// List answers GET /home/chores.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	cs, err := h.store.List(r.Context(), identity.CurrentMembership(r.Context()).Home.ID)
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"chores": cs})
}

// Create answers POST /home/chores.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	c, err := h.store.Create(r.Context(), identity.CurrentMembership(r.Context()).Home.ID, f, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "chores", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, c)
}

// Update answers PUT /home/chores/{id}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	f, ok := readChore(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "chore not found")
		return
	}
	c, err := h.store.Update(r.Context(), identity.CurrentMembership(r.Context()).Home.ID, id, f, h.clock.Now())
	if err != nil {
		h.failed(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

// Delete answers DELETE /home/chores/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "chore not found")
		return
	}
	if err := h.store.Delete(r.Context(), identity.CurrentMembership(r.Context()).Home.ID, id); err != nil {
		h.failed(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
