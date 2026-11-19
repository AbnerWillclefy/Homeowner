package pantry

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBodyBytes      = 4 << 10
	maxDraftBodyBytes = 64 << 10 // 200 lines of a draft
	maxPhotoBytes     = 3 << 19  // 1.5 MB: the PWA downsizes the photo before it sends it
	maxLen            = 60       // the Revenue form checks the same limit
	// photoDailyCap is how many photo reads one User may cause a day (São
	// Paulo). Change the constant to change the cap.
	photoDailyCap = 10
	// photoTimeout bounds one model call: the API Lambda's own timeout is 25 s.
	photoTimeout = 20 * time.Second
)

// jpegMagic starts every JPEG file.
var jpegMagic = []byte{0xFF, 0xD8, 0xFF}

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
	store  *Store
	nfce   nfce.Client             // nil: reading a receipt by its code answers 503
	reader *llmalloc.ReceiptReader // nil: reading a photo answers 503
	model  string                  // recorded on an event row when a call reported no Usage
	clk    clock.Clock
	log    *slog.Logger
}

// NewHandler returns a Handler over store; nfce reads receipts from SEFAZ and
// photos, when not nil, reads them from a photo through the model.
func NewHandler(store *Store, client nfce.Client, photos llmalloc.Client, model string, clk clock.Clock, log *slog.Logger) *Handler {
	h := &Handler{store: store, nfce: client, model: model, clk: clk, log: log}
	if photos != nil {
		h.reader = llmalloc.NewReceiptReader(photos)
	}
	return h
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

// AddReceipt answers POST /me/finance/pantry/receipts, whose body holds exactly
// one of "code" (read from SEFAZ) and "draft" (read from a photo, confirmed by
// the User): 201 with the receipt just saved, or 200 with the one already
// saved, which is then never fetched or written again.
func (h *Handler) AddReceipt(w http.ResponseWriter, r *http.Request) {
	var req receiptRequest
	if !httpx.DecodeBody(w, r, &req, maxDraftBodyBytes, true) {
		return
	}
	switch {
	case req.Code != nil && req.Draft == nil:
		h.addByCode(w, r, *req.Code)
	case req.Draft != nil && req.Code == nil:
		h.addByDraft(w, r, *req.Draft)
	default:
		httpx.WriteError(w, http.StatusBadRequest, "invalid_code")
	}
}

func (h *Handler) addByCode(w http.ResponseWriter, r *http.Request, code string) {
	if h.nfce == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "receipts unavailable")
		return
	}
	key, err := nfce.ParseCode(code)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_code")
		return
	}
	userID := identity.CurrentUser(r.Context()).ID
	saved, err := h.store.ReceiptByKey(r.Context(), userID, key)
	if err == nil {
		httpx.WriteJSON(w, http.StatusOK, saved)
		return
	}
	if !errors.Is(err, errNotFound) {
		h.fail(w, "pantry: receipt by key", err)
		return
	}
	// Outside any transaction: SEFAZ can take its whole timeout.
	rc, err := h.nfce.Fetch(r.Context(), key)
	switch {
	case errors.Is(err, nfce.ErrUnsupportedState):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "unsupported_state")
		return
	case err != nil:
		// The state and the kind of failure, never the page.
		h.log.Warn("pantry: sefaz unavailable", "state", key[:2], "error", err.Error())
		httpx.WriteError(w, http.StatusBadGateway, "sefaz_unavailable")
		return
	}
	h.save(w, r, userID, key, rc, readBySEFAZ)
}

// addByDraft saves a draft the User confirmed. The model's answer is never
// trusted, and neither is a client that skipped the check: the draft is
// validated again here.
func (h *Handler) addByDraft(w http.ResponseWriter, r *http.Request, draft llmalloc.ReceiptDraft) {
	draft, bad := ValidateDraft(draft, h.today())
	if len(bad) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_draft", "fields": bad})
		return
	}
	issued, _ := time.Parse(time.DateOnly, draft.IssuedOn) // checked by ValidateDraft
	rc := nfce.Receipt{StoreName: draft.StoreName, CNPJ: draft.StoreCNPJ, IssuedOn: issued, TotalCents: draft.TotalCents}
	for _, l := range draft.Lines {
		rc.Lines = append(rc.Lines, nfce.Line{Description: l.Description, QuantityMilli: l.QuantityMilli, Unit: l.Unit,
			UnitPriceCents: l.UnitPriceCents, TotalCents: l.TotalCents})
	}
	h.save(w, r, identity.CurrentUser(r.Context()).ID, draft.AccessKey, rc, readByPhoto)
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request, userID, key string, rc nfce.Receipt, readBy string) {
	rec, created, err := h.store.AddReceipt(r.Context(), userID, key, rc, readBy, h.clk.Now())
	if err != nil {
		h.fail(w, "pantry: add receipt", err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	httpx.WriteJSON(w, status, rec)
}

// today is the date in São Paulo, at midnight UTC.
func (h *Handler) today() time.Time {
	y, m, d := h.clk.Now().In(saoPaulo).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// ReadPhoto answers POST /me/finance/pantry/receipts/photo: the body is one
// JPEG, the answer is the draft the model read, and nothing is saved. The photo
// is held in memory for the call and never stored or logged.
func (h *Handler) ReadPhoto(w http.ResponseWriter, r *http.Request) {
	if h.reader == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "photo reading unavailable")
		return
	}
	if mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); mt != "image/jpeg" {
		httpx.WriteError(w, http.StatusUnsupportedMediaType, "not_jpeg")
		return
	}
	photo, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxPhotoBytes))
	var tooBig *http.MaxBytesError
	switch {
	case errors.As(err, &tooBig):
		httpx.WriteError(w, http.StatusRequestEntityTooLarge, "photo_too_large")
		return
	case err != nil:
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	case !bytes.HasPrefix(photo, jpegMagic):
		httpx.WriteError(w, http.StatusUnsupportedMediaType, "not_jpeg")
		return
	}

	ctx := r.Context()
	now := h.clk.Now()
	day := h.today()
	// Reserved right before the call: a call that fails still counts.
	ok, err := h.store.ReservePhotoCall(ctx, identity.CurrentUser(ctx).ID, day, photoDailyCap)
	if err != nil {
		h.fail(w, "pantry: reserve photo call", err)
		return
	}
	if !ok {
		h.store.recordPhotoEvent(ctx, h.log, h.model, photoEvent{now: now, day: day, outcome: "skipped_cap"})
		httpx.WriteError(w, http.StatusTooManyRequests, "photo_cap")
		return
	}

	callCtx, cancel := context.WithTimeout(ctx, photoTimeout)
	start := time.Now()
	draft, usage, err := h.reader.Read(callCtx, photo)
	cancel()
	ev := photoEvent{now: now, day: day, usage: usage, latency: time.Since(start), called: true}
	if err != nil {
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			ev.outcome = "timeout"
		case errors.Is(err, llmalloc.ErrInvalidResponse):
			ev.outcome = "invalid_response"
		default:
			ev.outcome = "error"
		}
		h.store.recordPhotoEvent(ctx, h.log, h.model, ev)
		h.log.Warn("pantry: photo read failed", "outcome", ev.outcome) // never the error: it can quote the answer
		httpx.WriteError(w, http.StatusBadGateway, "photo_unreadable")
		return
	}
	ev.outcome, ev.lines = "accepted", len(draft.Lines)
	h.store.recordPhotoEvent(ctx, h.log, h.model, ev)
	// Answered even when it fails the check: the User is about to correct it.
	draft, _ = ValidateDraft(draft, day)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"draft": draft})
}

// MatchLine answers PUT /me/finance/pantry/receipts/{id}/lines/{n}.
func (h *Handler) MatchLine(w http.ResponseWriter, r *http.Request) {
	id := itemID(w, r)
	n, nerr := strconv.ParseInt(r.PathValue("n"), 10, 32)
	if id == "" {
		return
	}
	if nerr != nil || n < 1 {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	var req matchRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	var m Match
	chosen := 0
	if req.ItemID != nil {
		chosen++
		m.ItemID = *req.ItemID
	}
	if req.Ignore != nil {
		chosen++
		m.Ignore = *req.Ignore
	}
	if req.NewItem != nil {
		chosen++
		m.NewItem = true
		if req.NewItem.Name != nil {
			m.NewName = strings.TrimSpace(*req.NewItem.Name)
		}
		if req.NewItem.Brand != nil {
			var ok bool
			if m.NewBrand, ok = brand(*req.NewItem.Brand); !ok {
				chosen = 0
			}
		}
	}
	if chosen != 1 || (req.Ignore != nil && !*req.Ignore) || (m.NewItem && !validName(m.NewName)) || (req.ItemID != nil && !uuidRe.MatchString(m.ItemID)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid match")
		return
	}
	rec, err := h.store.MatchLine(r.Context(), identity.CurrentUser(r.Context()).ID, id, int(n), m, h.clk.Now())
	if err != nil {
		h.fail(w, "pantry: match line", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rec)
}
