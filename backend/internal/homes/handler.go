package homes

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxSettingsBody = 4 * 1024
	// maxNewHomeBody and maxNewHomeChores bound POST /home, which also carries
	// the reviewed Chores. The Catalog proposes at most catalog.MaxProposals.
	maxNewHomeBody   = 64 * 1024
	maxNewHomeChores = 100
)

// Handler serves the /home routes.
type Handler struct {
	store    *Store
	photoURL func(*string) *string
	clock    clock.Clock
	log      *slog.Logger
}

// NewHandler returns a Handler over store. photoURL turns a stored photo key
// into its public URL (nil when photos are off).
func NewHandler(store *Store, photoURL func(*string) *string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, photoURL: photoURL, clock: clk, log: log}
}

// Residents answers GET /home/residents: the Residents of the caller's Home,
// in join order, each with the name to show. No email is ever serialised.
func (h *Handler) Residents(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	rows, err := h.store.Residents(r.Context(), m.Home.ID)
	if err != nil {
		httpx.InternalError(w, h.log, "list residents", err)
		return
	}
	out := make([]ResidentResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, NewResidentResponse(row, m.ResidentID, h.photoURL))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// readSettings decodes and validates the body, writing the error response
// itself when it is not acceptable.
func readSettings(w http.ResponseWriter, r *http.Request) (settingsBody, bool) {
	var body settingsBody
	if !httpx.DecodeBody(w, r, &body, maxSettingsBody, true) {
		return body, false
	}
	if fields := body.validate(); len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid home", "fields": fields})
		return body, false
	}
	return body, true
}

// readNewHome decodes and validates the body, settings and Chores together
// with all errors at once, writing the error response itself when it is not
// acceptable.
func readNewHome(w http.ResponseWriter, r *http.Request) (settingsBody, []chores.Fields, bool) {
	var body newHomeBody
	if !httpx.DecodeBody(w, r, &body, maxNewHomeBody, true) {
		return body.settingsBody, nil, false
	}
	fields := body.validate()
	var parsed []chores.Fields
	if len(body.Chores) > maxNewHomeChores {
		fields["chores"] = "too_many"
	} else {
		for i, in := range body.Chores {
			f, errs := chores.Validate(in)
			for name, code := range errs {
				fields[fmt.Sprintf("chores.%d.%s", i, name)] = code
			}
			parsed = append(parsed, f)
		}
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid home", "fields": fields})
		return body.settingsBody, nil, false
	}
	return body.settingsBody, parsed, true
}

// Create answers POST /home.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	body, cs, ok := readNewHome(w, r)
	if !ok {
		return
	}
	now := h.clock.Now()
	home, err := h.store.Create(r.Context(), identity.CurrentUser(r.Context()).ID, body.Timezone, body.AllocationTime, now, cs)
	if errors.Is(err, ErrAlreadyResident) {
		httpx.WriteError(w, http.StatusConflict, "already a resident")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "create home", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, NewResponse(home))
}

// Get answers GET /home.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, NewResponse(identity.CurrentMembership(r.Context()).Home))
}

// Leave removes the caller from their Home. The Resident and Home come from
// the Membership, so the request names no one and cannot remove another
// Resident. A repeated leave that races past the resident check is a no-op.
func (h *Handler) Leave(w http.ResponseWriter, r *http.Request) {
	m := identity.CurrentMembership(r.Context())
	if err := h.store.Leave(r.Context(), m.ResidentID, m.Home.ID); err != nil {
		httpx.InternalError(w, h.log, "leave home", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Update answers PUT /home.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	body, ok := readSettings(w, r)
	if !ok {
		return
	}
	home := identity.CurrentMembership(r.Context()).Home
	err := h.store.UpdateSettings(r.Context(), home.ID, body.Timezone, body.AllocationTime, h.clock.Now())
	if errors.Is(err, ErrNoHome) {
		httpx.WriteError(w, http.StatusNotFound, "no home")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "update home settings", err)
		return
	}
	home.Timezone, home.AllocationTime = body.Timezone, body.AllocationTime
	httpx.WriteJSON(w, http.StatusOK, NewResponse(home))
}
