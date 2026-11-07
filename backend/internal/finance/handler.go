package finance

import (
	"log/slog"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBodyBytes  = 2 << 10
	maxCredential = 200
)

// Handler serves the Finances routes behind the allowlist guard. The key is
// never nil here: the guard answers 503 first.
type Handler struct {
	store *Store
	key   *[32]byte
	clk   clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler that seals with key.
func NewHandler(store *Store, key *[32]byte, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, key: key, clk: clk, log: log}
}

// Status answers GET /me/finance. It never decrypts anything.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	ok, err := h.store.HasCredentials(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read status", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, StatusResponse{Configured: ok})
}

// PutCredentials answers PUT /me/finance/credentials.
func (h *Handler) PutCredentials(w http.ResponseWriter, r *http.Request) {
	var req CredentialsRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	id, secret := strings.TrimSpace(req.ClientID), strings.TrimSpace(req.ClientSecret)
	fields := map[string]string{}
	if msg := credentialProblem(id); msg != "" {
		fields["clientId"] = msg
	}
	if msg := credentialProblem(secret); msg != "" {
		fields["clientSecret"] = msg
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid credentials", "fields": fields})
		return
	}
	userID := identity.CurrentUser(r.Context()).ID
	idEnc, err := Seal(h.key, userID, FieldClientID, []byte(id))
	if err != nil {
		httpx.InternalError(w, h.log, "finance: seal client id", err)
		return
	}
	secretEnc, err := Seal(h.key, userID, FieldClientSecret, []byte(secret))
	if err != nil {
		httpx.InternalError(w, h.log, "finance: seal client secret", err)
		return
	}
	if err := h.store.SaveCredentials(r.Context(), userID, idEnc, secretEnc, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: save credentials", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteCredentials answers DELETE /me/finance/credentials.
func (h *Handler) DeleteCredentials(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteCredentials(r.Context(), identity.CurrentUser(r.Context()).ID); err != nil {
		httpx.InternalError(w, h.log, "finance: delete credentials", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// credentialProblem is empty when v is 1 to 200 characters with no control ones.
func credentialProblem(v string) string {
	if n := utf8.RuneCountInString(v); n < 1 || n > maxCredential {
		return "must be 1 to 200 characters"
	}
	if strings.IndexFunc(v, unicode.IsControl) >= 0 {
		return "must not contain control characters"
	}
	return ""
}
