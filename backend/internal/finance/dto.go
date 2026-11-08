package finance

import "time"

// StatusResponse is the Finances status on the wire.
type StatusResponse struct {
	Configured bool             `json:"configured"`
	Sources    []SourceResponse `json:"sources"`
	// Importing is true while any Item has not finished its first import.
	Importing bool `json:"importing"`
	// LastSyncedAt is the oldest sync across the Items, null while any has
	// never synced.
	LastSyncedAt *time.Time `json:"lastSyncedAt"`
}

// SourceResponse is one bank account or card the User connected.
type SourceResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Currency string `json:"currency"`
}

// CredentialsRequest is the body of PUT /me/finance/credentials.
type CredentialsRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// TransactionResponse is one Transaction on the wire. AmountCents is signed:
// negative is money out. What was spent is -AmountCents, for Expenses.
type TransactionResponse struct {
	ID               string               `json:"id"`
	PostedOn         string               `json:"postedOn"`
	Description      string               `json:"description"`
	SourceName       string               `json:"sourceName"`
	AmountCents      int64                `json:"amountCents"`
	Currency         string               `json:"currency"`
	Type             string               `json:"type"`
	SpendingCategory *string              `json:"spendingCategory"`
	TypeSetBy        string               `json:"typeSetBy"`
	CategorySetBy    *string              `json:"categorySetBy"`
	Installment      *InstallmentResponse `json:"installment"`
}

// InstallmentResponse is "number of total" of a card purchase paid in parts.
type InstallmentResponse struct {
	Number int `json:"number"`
	Total  int `json:"total"`
}

// CategoryTotal is the spend of one Spending Category.
type CategoryTotal struct {
	Category   string `json:"category"`
	SpentCents int64  `json:"spentCents"`
}

// MonthResponse is the answer of GET /me/finance/transactions.
type MonthResponse struct {
	Month        string                `json:"month"`
	SpentCents   int64                 `json:"spentCents"`
	Categories   []CategoryTotal       `json:"categories"`
	Transactions []TransactionResponse `json:"transactions"`
}

// ReportMonth is one month of GET /me/finance/report: all 13 categories, in order.
type ReportMonth struct {
	Month      string          `json:"month"`
	SpentCents int64           `json:"spentCents"`
	Categories []CategoryTotal `json:"categories"`
}

// ReportResponse is the answer of GET /me/finance/report.
type ReportResponse struct {
	Month    ReportMonth `json:"month"`
	Previous ReportMonth `json:"previous"`
}

// PatchTransactionRequest is the body of PATCH /me/finance/transactions/{id}:
// an absent field is left as it is.
type PatchTransactionRequest struct {
	Type             *string `json:"type"`
	SpendingCategory *string `json:"spendingCategory"`
}

// ConnectItemRequest is the body of POST /me/finance/items.
type ConnectItemRequest struct {
	ItemID string `json:"itemId"`
}

// ConnectTokenResponse is the answer of POST /me/finance/connect-token.
type ConnectTokenResponse struct {
	ConnectToken string `json:"connectToken"`
	// IncludeSandbox tells the PWA to offer Pluggy's sandbox connectors.
	IncludeSandbox bool `json:"includeSandbox"`
}
