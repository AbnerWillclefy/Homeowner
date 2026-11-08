package finance

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

const (
	maxBodyBytes  = 2 << 10
	maxCredential = 200
)

// itemIDPattern is a sanity bound on a Pluggy Item id; Pluggy issues uuids.
var itemIDPattern = regexp.MustCompile(`^[0-9a-zA-Z-]{1,64}$`)

// Handler serves the Finances routes behind the allowlist guard. The key is
// never nil here: the guard answers 503 first.
type Handler struct {
	store  *Store
	key    *[32]byte
	pluggy pluggy.Client // nil: the routes that call Pluggy answer 503
	env    string
	clk    clock.Clock
	log    *slog.Logger
}

// NewHandler returns a Handler that seals with key and reads banks through
// client. env is the deployment name: only production hides Pluggy's sandbox.
func NewHandler(store *Store, key *[32]byte, client pluggy.Client, env string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, key: key, pluggy: client, env: env, clk: clk, log: log}
}

// Status answers GET /me/finance. It never decrypts anything.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	userID := identity.CurrentUser(r.Context()).ID
	st, err := h.store.Overview(r.Context(), userID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read status", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, st)
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

// ConnectToken answers POST /me/finance/connect-token: a short-lived token the
// PWA hands to Pluggy Connect.
func (h *Handler) ConnectToken(w http.ResponseWriter, r *http.Request) {
	apiKey, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	token, err := h.pluggy.CreateConnectToken(r.Context(), apiKey)
	if err != nil {
		h.pluggyFailed(w, "create connect token", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ConnectTokenResponse{ConnectToken: token, IncludeSandbox: h.env != "production"})
}

// ConnectItem answers POST /me/finance/items: it registers an Item the User
// authorised and stores one Source per account. Repeating it adds nothing.
func (h *Handler) ConnectItem(w http.ResponseWriter, r *http.Request) {
	var req ConnectItemRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if !itemIDPattern.MatchString(req.ItemID) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid item id")
		return
	}
	apiKey, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	// Asking Pluggy with the User's own key stops them registering an Item
	// from someone else's Pluggy application.
	if _, err := h.pluggy.GetItem(r.Context(), apiKey, req.ItemID); errors.Is(err, pluggy.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		h.pluggyFailed(w, "get item", err)
		return
	}
	accounts, err := h.pluggy.ListAccounts(r.Context(), apiKey, req.ItemID)
	if err != nil {
		h.pluggyFailed(w, "list accounts", err)
		return
	}
	var sources []NewSource
	for _, a := range accounts {
		if kind := sourceKind(a); kind != "" {
			sources = append(sources, NewSource{PluggyAccountID: a.ID, Kind: kind, Name: a.Name, Currency: a.Currency})
		}
	}
	if err := h.store.ConnectItem(r.Context(), identity.CurrentUser(r.Context()).ID, req.ItemID, h.clk.Now(), sources); err != nil {
		httpx.InternalError(w, h.log, "finance: connect item", err)
		return
	}
	h.Status(w, r)
}

// sourceKind maps a Pluggy account to a Source kind; investments, loans and
// anything else give "" and are skipped.
func sourceKind(a pluggy.Account) string {
	switch {
	case a.Type == "BANK" && a.Subtype == "CHECKING_ACCOUNT":
		return "checking"
	case a.Type == "BANK" && a.Subtype == "SAVINGS_ACCOUNT":
		return "savings"
	case a.Type == "CREDIT":
		return "credit_card"
	}
	return ""
}

// authenticate opens the User's credentials into locals, trades them for an
// API key and returns it; on failure it has answered. The plaintext and the
// key live only in this call and its caller's frame.
func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (apiKey string, ok bool) {
	if h.pluggy == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "finance not configured")
		return "", false
	}
	userID := identity.CurrentUser(r.Context()).ID
	idEnc, secretEnc, found, err := h.store.Credentials(r.Context(), userID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: load credentials", err)
		return "", false
	}
	if !found {
		httpx.WriteError(w, http.StatusConflict, "no credentials")
		return "", false
	}
	id, err := Open(h.key, userID, FieldClientID, idEnc)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: open client id", err)
		return "", false
	}
	secret, err := Open(h.key, userID, FieldClientSecret, secretEnc)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: open client secret", err)
		return "", false
	}
	apiKey, err = h.pluggy.Auth(r.Context(), string(id), string(secret))
	if errors.Is(err, pluggy.ErrUnauthorized) {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "pluggy_credentials_rejected")
		return "", false
	}
	if err != nil {
		h.pluggyFailed(w, "auth", err)
		return "", false
	}
	return apiKey, true
}

// pluggyFailed answers a calm 502. The adapter's errors hold the operation
// and the status only, so logging err is safe.
func (h *Handler) pluggyFailed(w http.ResponseWriter, what string, err error) {
	h.log.Error("finance: pluggy "+what, "error", err.Error())
	httpx.WriteError(w, http.StatusBadGateway, "pluggy unavailable")
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
