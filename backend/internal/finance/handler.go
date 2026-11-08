package finance

import (
	"cmp"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

const (
	maxBodyBytes  = 2 << 10
	maxCredential = 200
)

// itemIDPattern accepts only a uuid, the form Pluggy issues Item ids in.
var itemIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

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

// Month answers GET /me/finance/transactions?month=YYYY-MM. The totals come from
// MonthTotals over the rows just read, so every endpoint that shows money agrees.
func (h *Handler) Month(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	from, to, ok := parseMonth(month)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid month")
		return
	}
	txns, err := h.store.MonthTransactions(r.Context(), identity.CurrentUser(r.Context()).ID, from, to)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read month", err)
		return
	}
	limits, err := h.store.Budgets(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read budgets", err)
		return
	}
	totals := MonthTotals(toTxns(txns))
	cats := []CategoryTotal{}
	for c, cents := range totals.ByCategory {
		if cents != 0 {
			cats = append(cats, CategoryTotal{Category: c, SpentCents: cents})
		}
	}
	slices.SortFunc(cats, func(a, b CategoryTotal) int {
		return cmp.Or(cmp.Compare(b.SpentCents, a.SpentCents), cmp.Compare(a.Category, b.Category))
	})
	httpx.WriteJSON(w, http.StatusOK, MonthResponse{Month: month, SpentCents: totals.Spend, Categories: cats, Transactions: txns, Limits: limits})
}

// SpendingCategories is the fixed, ordered list of Spending Category ids.
var SpendingCategories = llmalloc.SpendingCategories

func toTxns(rows []TransactionResponse) []Txn {
	in := make([]Txn, len(rows))
	for i, t := range rows {
		in[i] = Txn{Type: t.Type, AmountCents: t.AmountCents}
		if t.SpendingCategory != nil {
			in[i].Category = *t.SpendingCategory
		}
	}
	return in
}

// Report answers GET /me/finance/report?month=YYYY-MM: the month and the one
// before it, from one read of both and MonthTotals on each, so it agrees with Month.
func (h *Handler) Report(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	from, to, ok := parseMonth(month)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid month")
		return
	}
	prevFrom := time.Date(from.Year(), from.Month()-1, 1, 0, 0, 0, 0, time.UTC)
	txns, err := h.store.MonthTransactions(r.Context(), identity.CurrentUser(r.Context()).ID, prevFrom, to)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read report", err)
		return
	}
	var cur, prev []TransactionResponse
	for _, t := range txns {
		if t.PostedOn >= from.Format(time.DateOnly) {
			cur = append(cur, t)
		} else {
			prev = append(prev, t)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, ReportResponse{
		Month:    reportMonth(month, cur),
		Previous: reportMonth(prevFrom.Format("2006-01"), prev),
	})
}

func reportMonth(month string, rows []TransactionResponse) ReportMonth {
	totals := MonthTotals(toTxns(rows))
	cats := make([]CategoryTotal, len(SpendingCategories))
	for i, c := range SpendingCategories {
		cats[i] = CategoryTotal{Category: c, SpentCents: totals.ByCategory[c]}
	}
	return ReportMonth{Month: month, SpentCents: totals.Spend, Categories: cats}
}

// commitmentMonths is the horizon of GET /me/finance/commitments.
const commitmentMonths = 12

// Commitments answers GET /me/finance/commitments?from=YYYY-MM: 12 months from
// `from`, each with the installments its plans still owe.
// Each month also lists the User's unpaid Bills and counts their expected amounts.
func (h *Handler) Commitments(w http.ResponseWriter, r *http.Request) {
	from, _, ok := parseMonth(r.URL.Query().Get("from"))
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid month")
		return
	}
	plans, err := h.store.InstallmentPlans(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read commitments", err)
		return
	}
	income, err := h.store.Income(r.Context(), identity.CurrentUser(r.Context()).ID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read income", err)
		return
	}
	months := make([]MonthCommitment, commitmentMonths)
	for i, lines := range ProjectInstallments(plans, from, commitmentMonths) {
		m := MonthCommitment{Month: from.AddDate(0, i, 0).Format("2006-01"), Installments: []InstallmentLine{}, Bills: []BillLine{}}
		for _, l := range lines {
			m.Installments = append(m.Installments, l)
			m.CommittedCents += l.AmountCents
		}
		bills, err := h.store.MonthBills(r.Context(), identity.CurrentUser(r.Context()).ID, from.AddDate(0, i, 0))
		if err != nil {
			httpx.InternalError(w, h.log, "finance: read commitment bills", err)
			return
		}
		for _, b := range bills {
			if !b.Paid {
				m.Bills = append(m.Bills, BillLine{ID: b.ID, Name: b.Name, ExpectedCents: b.ExpectedCents})
				m.CommittedCents += b.ExpectedCents
			}
		}
		if income != nil { // income <= 10^12 and committed is small, so *100 cannot overflow int64
			pct := (m.CommittedCents*100 + *income/2) / *income
			m.PercentOfIncome = &pct
		}
		months[i] = m
	}
	httpx.WriteJSON(w, http.StatusOK, CommitmentsResponse{From: from.Format("2006-01"), MonthlyIncomeCents: income, Months: months})
}

// maxIncomeCents bounds the income so the percentage arithmetic cannot overflow.
const maxIncomeCents = 1_000_000_000_000

// PutIncome answers PUT /me/finance/income: sets the Monthly income, or clears it with null.
func (h *Handler) PutIncome(w http.ResponseWriter, r *http.Request) {
	var req IncomeRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if v := req.MonthlyIncomeCents; v != nil && (*v <= 0 || *v > maxIncomeCents) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid income")
		return
	}
	if err := h.store.SetIncome(r.Context(), identity.CurrentUser(r.Context()).ID, req.MonthlyIncomeCents, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set income", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PatchTransaction answers PATCH /me/finance/transactions/{id}. A malformed id
// and another User's row both answer 404, so ids cannot be probed.
func (h *Handler) PatchTransaction(w http.ResponseWriter, r *http.Request) {
	var req PatchTransactionRequest
	if !httpx.DecodeBody(w, r, &req, 1<<10, true) {
		return
	}
	if (req.Type == nil && req.SpendingCategory == nil) ||
		(req.Type != nil && !slices.Contains([]string{"income", "expense", "transfer"}, *req.Type)) ||
		(req.SpendingCategory != nil && !slices.Contains(llmalloc.SpendingCategories, *req.SpendingCategory)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid transaction edit")
		return
	}
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	t, found, err := h.store.UpdateTransaction(r.Context(), identity.CurrentUser(r.Context()).ID, id, req.Type, req.SpendingCategory, h.clk.Now())
	switch {
	case errors.Is(err, ErrCategoryNeedsExpense):
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		httpx.InternalError(w, h.log, "finance: update transaction", err)
	case !found:
		httpx.WriteError(w, http.StatusNotFound, "not found")
	default:
		httpx.WriteJSON(w, http.StatusOK, t)
	}
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

// DeleteAll answers DELETE /me/finance: all the User's finance data, nothing else.
func (h *Handler) DeleteAll(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteAll(r.Context(), identity.CurrentUser(r.Context()).ID); err != nil {
		httpx.InternalError(w, h.log, "finance: delete all", err)
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
	item, err := h.pluggy.GetItem(r.Context(), apiKey, req.ItemID)
	if errors.Is(err, pluggy.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		h.pluggyFailed(w, "get item", err)
		return
	}
	if item.Status == "LOGIN_ERROR" {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "item login failed")
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
	if len(sources) == 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "no supported accounts")
		return
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
