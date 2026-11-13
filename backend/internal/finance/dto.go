package finance

import (
	"encoding/json"
	"time"
)

// GoalRequest is the body of POST /me/finance/goals and PUT /me/finance/goals/{id}.
// TargetCents stays raw so a fractional or non-numeric value is refused by field.
type GoalRequest struct {
	Name        string          `json:"name"`
	TargetCents json.RawMessage `json:"targetCents"`
	TargetMonth *string         `json:"targetMonth"`
}

// GoalInput is a validated GoalRequest; TargetMonth is the first day of the month.
type GoalInput struct {
	Name        string
	TargetCents int64
	TargetMonth *time.Time
}

// GoalOrderRequest is the body of PUT /me/finance/goals/order.
type GoalOrderRequest struct {
	IDs []string `json:"ids"`
}

// GoalResponse is a Goal as created, updated or listed; TargetMonth is "YYYY-MM" or null.
type GoalResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	TargetCents int64   `json:"targetCents"`
	TargetMonth *string `json:"targetMonth"`
}

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
	ID string `json:"id"`
	// Name is what to show: the User's display name when set, else BankName.
	Name     string `json:"name"`
	BankName string `json:"bankName"`
	Kind     string `json:"kind"`
	Currency string `json:"currency"`
	// CloseDay and DueDay are a card's bill days, null when not set and
	// always null on any other kind.
	CloseDay *int `json:"closeDay"`
	DueDay   *int `json:"dueDay"`
	// BalanceCents and BalanceOn are the latest balance the bank reported and
	// its day (YYYY-MM-DD); absent on a card, a non-BRL Source, and a Source
	// with no balance read yet.
	BalanceCents *int64  `json:"balanceCents,omitempty"`
	BalanceOn    *string `json:"balanceOn,omitempty"`
}

// BillDaysRequest is the body of PUT /me/finance/sources/{id}/bill-days: both
// days or neither, and null clears.
type BillDaysRequest struct {
	CloseDay *int `json:"closeDay"`
	DueDay   *int `json:"dueDay"`
}

// SourceNameRequest is the body of PUT /me/finance/sources/{id}/name: null
// clears the display name.
type SourceNameRequest struct {
	Name *string `json:"name"`
}

// CredentialsRequest is the body of PUT /me/finance/credentials.
type CredentialsRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// TransactionResponse is one Transaction on the wire. AmountCents is signed:
// negative is money out. What was spent is -AmountCents, for Expenses. Type is
// income, expense, transfer or saving; only an Expense has a SpendingCategory.
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
	// CountsOn (YYYY-MM-DD) is the day it counts as spent: PostedOn, or a card bill's due date (see CountsOn).
	CountsOn string `json:"countsOn"`
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
	// CommittedCents is the card bills due in the month plus the non-card Expenses counted in it.
	CommittedCents int64 `json:"committedCents"`
	// SpentSinceFirstCents is every Expense posted in the month, on any Source, by posted day.
	SpentSinceFirstCents int64 `json:"spentSinceFirstCents"`
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
//
// Installments are the parts of plans still to come; the rest is the outlook
// worked out by Outlook, plus the Daily allowance and the Pace worked out from
// its Leftover.
type MonthCommitment struct {
	Month        string            `json:"month"`
	Installments []InstallmentLine `json:"installments"`

	Cards      []CardBillLine  `json:"cards"`
	OtherBills []OtherBillLine `json:"otherBills"`
	// OtherInstallmentsCents is what plans on a Source that is not a credit card owe.
	OtherInstallmentsCents int64 `json:"otherInstallmentsCents"`
	// Planned is the rest of what each Spending Category plans (its limit, else
	// the average of the last 3 months' spend), PlannedCents their sum.
	Planned      []PlannedLineDTO `json:"planned"`
	PlannedCents int64            `json:"plannedCents"`
	// SpentOffCardCents is present only on the current month: what was spent off
	// the card, without Expenses that paid a Bill.
	SpentOffCardCents *int64 `json:"spentOffCardCents,omitempty"`
	// SavingCents is the larger of the month's actual saving and the Monthly contribution.
	SavingCents int64 `json:"savingCents"`
	// TotalCents is card bills, other Bills, installments off the card, planned,
	// spent off the card and the saving.
	TotalCents int64 `json:"totalCents"`
	// LeftoverCents is the Monthly income minus TotalCents, negative when the
	// month takes more; absent, not null, when no income is set.
	LeftoverCents *int64 `json:"leftoverCents,omitempty"`
	// DailyAllowanceCents is the Leftover over the days left in the month, today
	// included; present only on the current month (São Paulo) with a Monthly
	// income, negative when the Leftover is.
	DailyAllowanceCents *int64 `json:"dailyAllowanceCents,omitempty"`
	// Pace is the spending so far against the straight line to the month's end;
	// absent with no Monthly income and on future months, whole on past ones.
	Pace *PaceDTO `json:"pace,omitempty"`
}

// PaceDTO is the Pace of a month. SpentCents is the cumulative spend at the end
// of each day to date; LineEndCents is the straight line's value on the last
// day, the Monthly income minus the Leftover.
type PaceDTO struct {
	SpentCents   []int64 `json:"spentCents"`
	LineEndCents int64   `json:"lineEndCents"`
}

// CardBillLine is one credit card's bill in a month: the bank's total when it
// reported a bill due in the month, else the app's own sum (ADR 0021).
// BillDaysKnown is false when the card has no closing or due day, so charges
// count on the day made.
type CardBillLine struct {
	SourceID      string `json:"sourceId"`
	Name          string `json:"name"`
	AmountCents   int64  `json:"amountCents"`
	BillDaysKnown bool   `json:"billDaysKnown"`
}

// PlannedLineDTO is the rest of one Spending Category's limit in a month.
type PlannedLineDTO struct {
	Category string `json:"category"`
	Cents    int64  `json:"cents"`
}

// OtherBillLine is a Bill to pay that is not a card bill, paid or not; Cents is
// the amount the month was paid for when Paid.
type OtherBillLine struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Cents int64  `json:"cents"`
	Paid  bool   `json:"paid"`
}

// IncomeRequest is the body of PUT /me/finance/income; null clears the income.
type IncomeRequest struct {
	MonthlyIncomeCents *int64 `json:"monthlyIncomeCents"`
}

// CommitmentsResponse is the answer of GET /me/finance/commitments.
type CommitmentsResponse struct {
	From               string            `json:"from"`
	MonthlyIncomeCents *int64            `json:"monthlyIncomeCents"`
	Months             []MonthCommitment `json:"months"`
}

// PatchTransactionRequest is the body of PATCH /me/finance/transactions/{id}:
// an absent field is left as it is. Type is income, expense, transfer or saving.
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
	// CardPaid is set when the month's payment points to a credit card Transaction.
	CardPaid bool `json:"-"`
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
