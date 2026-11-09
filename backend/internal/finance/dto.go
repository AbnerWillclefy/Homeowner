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
	Limits       map[string]int64      `json:"limits"` // category to monthly limit; the same every month
}

// HistoryMonth is one month of GET /me/finance/history: all 13 categories, in order.
type HistoryMonth struct {
	Month      string          `json:"month"`
	SpentCents int64           `json:"spentCents"`
	Categories []CategoryTotal `json:"categories"`
}

// HistoryResponse is the answer of GET /me/finance/history, oldest month first.
type HistoryResponse struct {
	To     string         `json:"to"`
	Months []HistoryMonth `json:"months"`
}

// DailyResponse is the answer of GET /me/finance/daily: cumulative spend in
// cents at the end of each day. Current stops at today for the running month and
// is empty for a future one; Previous is the month before, whole; Average is the
// usual pace of the AverageMonths months before Month that have history, one
// entry per day of Month, empty when there are none.
type DailyResponse struct {
	Month         string  `json:"month"`
	Days          int     `json:"days"`
	Current       []int64 `json:"current"`
	Previous      []int64 `json:"previous"`
	Average       []int64 `json:"average"`
	AverageMonths int     `json:"averageMonths"`
}

// MonthCommitment is what a month already owes. Not the Task "commitments"
// table: that one is unrelated.
type MonthCommitment struct {
	Month          string            `json:"month"`
	CommittedCents int64             `json:"committedCents"`
	Installments   []InstallmentLine `json:"installments"`
	Bills          []BillLine        `json:"bills"`
	// PercentOfIncome is absent, not null, when no income is set, so "not set"
	// and 0% stay distinct.
	PercentOfIncome *int64 `json:"percentOfIncome,omitempty"`
}

// IncomeRequest is the body of PUT /me/finance/income; null clears the income.
type IncomeRequest struct {
	MonthlyIncomeCents *int64 `json:"monthlyIncomeCents"`
}

// BillLine is a Bill to pay in a month.
type BillLine struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ExpectedCents int64  `json:"expectedCents"`
}

// CommitmentsResponse is the answer of GET /me/finance/commitments.
type CommitmentsResponse struct {
	From               string            `json:"from"`
	MonthlyIncomeCents *int64            `json:"monthlyIncomeCents"`
	Months             []MonthCommitment `json:"months"`
}

// PatchTransactionRequest is the body of PATCH /me/finance/transactions/{id}:
// an absent field is left as it is.
type PatchTransactionRequest struct {
	Type             *string `json:"type"`
	SpendingCategory *string `json:"spendingCategory"`
}

// BillRequest is the body of POST /me/finance/bills and PUT /me/finance/bills/{id}.
type BillRequest struct {
	Name          string `json:"name"`
	ExpectedCents int64  `json:"expectedCents"`
	DueDay        int    `json:"dueDay"`
}

// BillResponse is a Bill as created or updated.
type BillResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ExpectedCents int64  `json:"expectedCents"`
	DueDay        int    `json:"dueDay"`
}

// MonthBill is a Bill with its due date and paid state in one month. PaidBy is
// null, "hand" or "bank"; PaidCents is null when unpaid.
type MonthBill struct {
	BillResponse
	DueDate   string  `json:"dueDate"`
	Paid      bool    `json:"paid"`
	PaidBy    *string `json:"paidBy"`
	PaidCents *int64  `json:"paidCents"`
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
