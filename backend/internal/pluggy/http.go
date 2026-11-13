package pluggy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const maxResponseBytes = 4 << 20

// HTTP is the net/http Client. It never logs, and an error carries the
// operation and the status only, never a body.
type HTTP struct {
	base string
	hc   *http.Client
}

// NewHTTP returns a Client that calls baseURL, for example https://api.pluggy.ai.
func NewHTTP(baseURL string) *HTTP {
	return &HTTP{base: strings.TrimRight(baseURL, "/"), hc: &http.Client{Timeout: 10 * time.Second}}
}

// do sends one request and decodes a 2xx JSON body into out.
func (h *HTTP) do(ctx context.Context, op, method, pathQuery, apiKey string, body, out any) error {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, h.base+pathQuery, rd)
	if err != nil {
		return fmt.Errorf("pluggy: %s: bad request", op)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if apiKey != "" {
		req.Header.Set("X-API-KEY", apiKey)
	}
	res, err := h.hc.Do(req)
	if err != nil {
		// The cause is dropped: a transport error can quote the URL.
		return fmt.Errorf("pluggy: %s: request failed", op)
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return fmt.Errorf("%w (%s)", ErrUnauthorized, op)
	case res.StatusCode == http.StatusNotFound:
		return fmt.Errorf("%w (%s)", ErrNotFound, op)
	case res.StatusCode < 200 || res.StatusCode > 299:
		return fmt.Errorf("pluggy: %s: status %d", op, res.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, maxResponseBytes)).Decode(out); err != nil {
		return fmt.Errorf("pluggy: %s: unreadable response", op)
	}
	return nil
}

// Auth implements Client.
func (h *HTTP) Auth(ctx context.Context, clientID, clientSecret string) (string, error) {
	var out struct {
		APIKey string `json:"apiKey"`
	}
	err := h.do(ctx, "auth", http.MethodPost, "/auth", "", map[string]string{"clientId": clientID, "clientSecret": clientSecret}, &out)
	return out.APIKey, err
}

// CreateConnectToken implements Client.
func (h *HTTP) CreateConnectToken(ctx context.Context, apiKey string) (string, error) {
	var out struct {
		AccessToken string `json:"accessToken"`
	}
	err := h.do(ctx, "connect token", http.MethodPost, "/connect_token", apiKey, map[string]string{}, &out)
	return out.AccessToken, err
}

// GetItem implements Client.
func (h *HTTP) GetItem(ctx context.Context, apiKey, itemID string) (Item, error) {
	var out struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	err := h.do(ctx, "get item", http.MethodGet, "/items/"+url.PathEscape(itemID), apiKey, nil, &out)
	return Item{ID: out.ID, Status: out.Status}, err
}

// ListAccounts implements Client.
// shortcut: one page of 500, an Item has a handful of accounts; follow totalPages if one ever has more.
func (h *HTTP) ListAccounts(ctx context.Context, apiKey, itemID string) ([]Account, error) {
	var out struct {
		Results []struct {
			ID       string      `json:"id"`
			Type     string      `json:"type"`
			Subtype  string      `json:"subtype"`
			Name     string      `json:"name"`
			Currency string      `json:"currencyCode"`
			Owner    string      `json:"owner"`
			TaxNo    string      `json:"taxNumber"`
			Balance  json.Number `json:"balance"`
			Credit   *struct {
				CloseDate string `json:"balanceCloseDate"`
				DueDate   string `json:"balanceDueDate"`
			} `json:"creditData"`
		} `json:"results"`
	}
	q := url.Values{"itemId": {itemID}, "pageSize": {"500"}}
	if err := h.do(ctx, "list accounts", http.MethodGet, "/accounts?"+q.Encode(), apiKey, nil, &out); err != nil {
		return nil, err
	}
	accts := make([]Account, len(out.Results))
	for i, r := range out.Results {
		accts[i] = Account{ID: r.ID, Type: r.Type, Subtype: r.Subtype, Name: r.Name, Currency: r.Currency, Owner: r.Owner, TaxNumber: r.TaxNo}
		// A bad balance gives nil, never an error: failing here would fail the whole Item.
		if c, err := parseCents(r.Balance.String()); err == nil && r.Balance != "" {
			accts[i].BalanceCents = &c
		}
		if r.Credit != nil {
			accts[i].CloseDay, accts[i].DueDay = dayOf(r.Credit.CloseDate), dayOf(r.Credit.DueDate)
			if accts[i].CloseDay == 0 || accts[i].DueDay == 0 {
				accts[i].CloseDay, accts[i].DueDay = 0, 0
			}
		}
	}
	return accts, nil
}

// httpParty is a paymentData payer or receiver; every field may be null.
type httpParty struct {
	Name     string `json:"name"`
	Document struct {
		Value string `json:"value"`
	} `json:"documentNumber"`
}

// ListTransactions implements Client against GET /v2/transactions, which pages
// by cursor: Pluggy answers "next" as a query string to send back, or null.
func (h *HTTP) ListTransactions(ctx context.Context, apiKey, accountID string, from, to time.Time, cursor string) (TransactionsPage, error) {
	var out struct {
		Results []struct {
			ID          string      `json:"id"`
			ProviderID  *string     `json:"providerId"`
			Date        time.Time   `json:"date"`
			Description string      `json:"description"`
			Amount      json.Number `json:"amount"`
			Currency    string      `json:"currencyCode"`
			Type        string      `json:"type"`
			Status      string      `json:"status"`
			Category    *string     `json:"category"`
			Payment     *struct {
				Payer    httpParty `json:"payer"`
				Receiver httpParty `json:"receiver"`
			} `json:"paymentData"`
			Card *struct {
				InstallmentNumber int `json:"installmentNumber"`
				TotalInstallments int `json:"totalInstallments"`
			} `json:"creditCardMetadata"`
		} `json:"results"`
		Next *string `json:"next"`
	}
	// The cursor is the query Pluggy gave back; it only ever extends our own path.
	query := cursor
	if cursor == "" {
		query = "?" + url.Values{"accountId": {accountID}, "dateFrom": {from.Format(time.DateOnly)}, "dateTo": {to.Format(time.DateOnly)}}.Encode()
	} else if !strings.HasPrefix(cursor, "?") {
		return TransactionsPage{}, errors.New("pluggy: list transactions: bad cursor")
	}
	if err := h.do(ctx, "list transactions", http.MethodGet, "/v2/transactions"+query, apiKey, nil, &out); err != nil {
		return TransactionsPage{}, err
	}
	page := TransactionsPage{Transactions: make([]Transaction, len(out.Results))}
	if out.Next != nil {
		page.Next = *out.Next
	}
	for i, r := range out.Results {
		cents, err := parseCents(r.Amount.String())
		if err != nil {
			return TransactionsPage{}, errors.New("pluggy: list transactions: unreadable amount")
		}
		tx := Transaction{ID: r.ID, ProviderID: r.ProviderID, Date: r.Date, Description: r.Description,
			AmountCents: cents, Currency: r.Currency, Type: r.Type, Status: r.Status, Category: r.Category}
		if r.Payment != nil {
			p := r.Payment.Receiver
			if cents > 0 {
				p = r.Payment.Payer
			}
			tx.Counterpart = &Party{Name: p.Name, Document: p.Document.Value}
		}
		if r.Card != nil {
			tx.CreditCardMetadata = &CreditCardMetadata{InstallmentNumber: r.Card.InstallmentNumber, TotalInstallments: r.Card.TotalInstallments}
		}
		page.Transactions[i] = tx
	}
	return page, nil
}

// ListBills implements Client against GET /bills; financeCharges and payments are ignored.
// shortcut: one page of 500, ADR 0019 says /bills pages by page; follow totalPages if a card ever has more.
func (h *HTTP) ListBills(ctx context.Context, apiKey, accountID string) ([]Bill, error) {
	var out struct {
		Results []struct {
			ID          string      `json:"id"`
			DueDate     time.Time   `json:"dueDate"`
			ClosingDate time.Time   `json:"billClosingDate"`
			Total       json.Number `json:"totalAmount"`
			Currency    string      `json:"totalAmountCurrencyCode"`
		} `json:"results"`
	}
	q := url.Values{"accountId": {accountID}, "pageSize": {"500"}}
	if err := h.do(ctx, "list bills", http.MethodGet, "/bills?"+q.Encode(), apiKey, nil, &out); err != nil {
		return nil, err
	}
	bills := make([]Bill, len(out.Results))
	for i, r := range out.Results {
		cents, err := parseCents(r.Total.String())
		if err != nil {
			return nil, errors.New("pluggy: list bills: unreadable amount")
		}
		bills[i] = Bill{ID: r.ID, DueDate: r.DueDate, ClosingDate: r.ClosingDate, TotalCents: cents, Currency: r.Currency}
	}
	return bills, nil
}

// dayOf is the day of month of a YYYY-MM-DD date (a timestamp's date part too), or 0.
func dayOf(s string) int {
	d, err := time.Parse(time.DateOnly, s[:min(len(s), len(time.DateOnly))])
	if err != nil {
		return 0
	}
	return d.Day()
}

// parseCents reads a decimal string of at most two decimals into centavos
// without a float: 0.29*100 is not 29. Exponents, signs other than a leading
// minus, and a third decimal are refused.
func parseCents(s string) (int64, error) {
	neg := strings.HasPrefix(s, "-")
	whole, frac, hasDot := strings.Cut(strings.TrimPrefix(s, "-"), ".")
	if whole == "" || len(frac) > 2 || hasDot && frac == "" {
		return 0, errors.New("bad amount")
	}
	for _, part := range []string{whole, frac} {
		for _, r := range part {
			if r < '0' || r > '9' {
				return 0, errors.New("bad amount")
			}
		}
	}
	units, err := strconv.ParseInt(whole, 10, 64)
	if err != nil || units > math.MaxInt64/100-1 {
		return 0, errors.New("bad amount")
	}
	f, _ := strconv.ParseInt((frac + "00")[:2], 10, 64)
	cents := units*100 + f
	if neg {
		cents = -cents
	}
	return cents, nil
}
