package pantry

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBodyBytes = 4 << 10
	maxLen       = 60 // the Revenue form checks the same limit
)

var (
	saoPaulo = mustLoad("America/Sao_Paulo")
	uuidRe   = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// Handler serves the Pantry routes, which sit behind the finance allowlist.
type Handler struct {
	store *Store
	clk   clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler over store.
func NewHandler(store *Store, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, clk: clk, log: log}
}

// fail answers a store error: 404 for a missing or foreign item, 409 for a
// taken name or an undo while in stock, else a bare 500. The log carries the
// Postgres code, never its text, which can quote a row.
func (h *Handler) fail(w http.ResponseWriter, what string, err error) {
	switch {
	case errors.Is(err, errNotFound):
		httpx.WriteError(w, http.StatusNotFound, "not found")
	case errors.Is(err, errNameTaken):
		httpx.WriteError(w, http.StatusConflict, "name_taken")
	case errors.Is(err, errNotRanOut):
		httpx.WriteError(w, http.StatusConflict, "not_ran_out")
	default:
		httpx.InternalError(w, h.log, what, errors.New(safeErr(err)))
	}
}

func safeErr(err error) string {
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		return "database error " + pg.Code
	}
	return err.Error()
}

// itemID is the {id} path value, or "" after answering 404 for a non-uuid.
func itemID(w http.ResponseWriter, r *http.Request) string {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return ""
	}
	return id
}

func validName(s string) bool {
	n := utf8.RuneCountInString(s)
	return n >= 1 && n <= maxLen && strings.IndexFunc(s, unicode.IsControl) < 0
}

// brand trims s; empty means none.
func brand(s string) (*string, bool) {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) > maxLen || strings.IndexFunc(s, unicode.IsControl) >= 0 {
		return nil, false
	}
	if s == "" {
		return nil, true
	}
	return &s, true
}

// List answers GET /me/finance/pantry.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.List(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		h.fail(w, "pantry: list", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// Create answers POST /me/finance/pantry/items.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if req.Name == nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid name")
		return
	}
	name := strings.TrimSpace(*req.Name)
	var b *string
	ok := true
	if req.PreferredBrand != nil {
		b, ok = brand(*req.PreferredBrand)
	}
	if !validName(name) || !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid name or brand")
		return
	}
	it, err := h.store.Create(r.Context(), identity.CurrentUser(r.Context()).ID, name, b, h.clk.Now())
	if err != nil {
		h.fail(w, "pantry: create", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, it)
}

// Update answers PATCH /me/finance/pantry/items/{id}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := itemID(w, r)
	if id == "" {
		return
	}
	var req patchRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	p := Patch{Fixed: req.Fixed}
	ok := true
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		ok = validName(name)
		p.Name = &name
	}
	if req.PreferredBrand != nil { // present: a string sets it, null clears it
		p.BrandSet = true
		var s *string
		if json.Unmarshal(req.PreferredBrand, &s) != nil {
			ok = false
		} else if s != nil {
			var bok bool
			p.Brand, bok = brand(*s)
			ok = ok && bok
		}
	}
	// An explicit null name decodes to nil too, so it counts as absent here.
	if !ok || (p.Name == nil && !p.BrandSet && p.Fixed == nil) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid item")
		return
	}
	it, err := h.store.Update(r.Context(), identity.CurrentUser(r.Context()).ID, id, p, h.clk.Now())
	if err != nil {
		h.fail(w, "pantry: update", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, it)
}

// Delete answers DELETE /me/finance/pantry/items/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := itemID(w, r)
	if id == "" {
		return
	}
	if err := h.store.Delete(r.Context(), identity.CurrentUser(r.Context()).ID, id); err != nil {
		h.fail(w, "pantry: delete", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RunOut answers POST /me/finance/pantry/items/{id}/run-outs with today in São Paulo.
func (h *Handler) RunOut(w http.ResponseWriter, r *http.Request) {
	id := itemID(w, r)
	if id == "" {
		return
	}
	now := h.clk.Now()
	y, m, d := now.In(saoPaulo).Date()
	day := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	if err := h.store.RunOut(r.Context(), identity.CurrentUser(r.Context()).ID, id, day, now); err != nil {
		h.fail(w, "pantry: run out", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UndoRunOut answers DELETE /me/finance/pantry/items/{id}/run-outs/latest.
func (h *Handler) UndoRunOut(w http.ResponseWriter, r *http.Request) {
	id := itemID(w, r)
	if id == "" {
		return
	}
	if err := h.store.UndoRunOut(r.Context(), identity.CurrentUser(r.Context()).ID, id); err != nil {
		h.fail(w, "pantry: undo run out", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
