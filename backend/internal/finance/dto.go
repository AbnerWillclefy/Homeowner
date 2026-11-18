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
	// Items is one entry per connected bank, never null.
	Items []ItemResponse `json:"items"`
	// Importing is true while any Item has not finished its first import.
	Importing bool `json:"importing"`
	// LastSyncedAt is the oldest sync across the Items, null while any has
	// never synced.
	LastSyncedAt *time.Time `json:"lastSyncedAt"`
}

// ItemResponse is one bank connection and whether it works.
type ItemResponse struct {
	ID string `json:"id"`
	// BankName is the institution's name, null until the first sync or connect after the column existed.
	BankName *string `json:"bankName"`
	// Status is "ok" or "reconnect" (ItemWireStatus).
	Status string `json:"status"`
	// Products is the number of the Item's Sources.
	Products int `json:"products"`
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
	// CreditLimitCents is a card's credit limit as its bank reports it; absent
	// on any other kind and on a card whose connector gives none.
	CreditLimitCents *int64 `json:"creditLimitCents,omitempty"`
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
	SourceID         string               `json:"sourceId"` // the Source (account or card) it belongs to
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
	// Note is the text the User wrote on it, null when there is none. On an installment every part of the purchase shares it.
	Note *string `json:"note"`
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

// HistoryMonth is one month of GET /me/finance/history: all 13 categories, in
// order. IncomeCents is what arrived (Income Transactions), SpentCents the
// Expenses net of refunds, SavedCents the net Saving (negative when the User
// took money back). Transfers are in none of them, so the month's result is
// IncomeCents - SpentCents - SavedCents.
type HistoryMonth struct {
	Month       string          `json:"month"`
	IncomeCents int64           `json:"incomeCents"`
	SpentCents  int64           `json:"spentCents"`
	SavedCents  int64           `json:"savedCents"`
	Categories  []CategoryTotal `json:"categories"`
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
	// its Usual spending: the median of the last 3 months' spend), PlannedCents
	// the sum of their Cents. A category is listed when either plan is above 0.
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
	// PacePlannedCents is the sum of the planned lines' PaceCents and
	// PaceLeftoverCents the Leftover at current pace: the Leftover with every
	// category planning its Usual spending instead of its limit. Both are
	// absent, not null, when no Monthly income is set.
	PacePlannedCents  *int64 `json:"pacePlannedCents,omitempty"`
	PaceLeftoverCents *int64 `json:"paceLeftoverCents,omitempty"`
	// DailyAllowanceCents is the Leftover plus PlannedCents over the days left in
	// the month, today included; present only on the current month (São Paulo)
	// with a Monthly income, negative when that sum is.
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
// reported the bill the month counts (due in the month, or in later months the next bill after the current month's, ADR 0024 amendment), else the app's own sum (ADR 0021).
// BillDaysKnown is false when the card has no closing or due day, so charges
// count on the day made. FromBank is true when AmountCents is the bank's total;
// Manual is true for a manual card: its AmountCents is typed (or carried forward from the latest typed month), it has no closing day and no bank bill. DueOn and ClosesOn (YYYY-MM-DD) are that bill's days, or in the current month
// those of the bill still to pay when known, null otherwise. In the current
// month Closed says that bill has closed, and HeldFrom and HeldTo bound the
// posted days [from, to) of the charges it holds (while open, HeldTo is the next closing, or the day after today without typed days); all
// three are absent-as-null and false on a card counted by month.
type CardBillLine struct {
	SourceID      string  `json:"sourceId"`
	Name          string  `json:"name"`
	AmountCents   int64   `json:"amountCents"`
	BillDaysKnown bool    `json:"billDaysKnown"`
	FromBank      bool    `json:"fromBank"`
	Manual        bool    `json:"manual"`
	DueOn         *string `json:"dueOn"`
	ClosesOn      *string `json:"closesOn"`
	Closed        bool    `json:"closed"`
	HeldFrom      *string `json:"heldFrom"`
	HeldTo        *string `json:"heldTo"`
}

// PlannedLineDTO is the rest of one Spending Category's plan in a month. Cents
// is the rest by plan (its limit, else its Usual spending) and PaceCents the
// rest at current pace (always its Usual spending, the median of the last 3
// months); both subtract what already counts and never go below 0. Limited is
// true when the category has a Spending limit: only then is PaceCents-Cents a
// gap worth showing.
type PlannedLineDTO struct {
	Category  string `json:"category"`
	Cents     int64  `json:"cents"`
	PaceCents int64  `json:"paceCents"`
	Limited   bool   `json:"limited"`
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
// Note is trimmed and at most 200 characters on one line; "" (or only spaces) clears it.
type PatchTransactionRequest struct {
	Type             *string `json:"type"`
	SpendingCategory *string `json:"spendingCategory"`
	Note             *string `json:"note"`
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

// NetWorthResponse is the answer of GET /me/finance/net-worth. HasData is false
// until a Source balance has been stored; Today is then null and Series empty.
// Series is balances plus Investments only: past days' card bills are not stored,
// so SeriesExcludesCardBills is always true and the client must not show its last
// point as the Net worth.
//
// MonthStart is null without data. It holds the balances and Investments on the
// last day of the previous month (São Paulo), so a change on the 1st counts in
// this month; a Source or Investment with no value by then starts at its first
// value of the month. MonthChange is today's balances and Investments less those,
// and its TotalCents is balances plus Investments only, never Today.TotalCents'
// change: card bills are left out because past days' bills are not stored.
type NetWorthResponse struct {
	HasData                 bool            `json:"hasData"`
	Today                   *NetWorthToday  `json:"today"`
	Series                  []NetWorthPoint `json:"series"`
	SeriesExcludesCardBills bool            `json:"seriesExcludesCardBills"`
	MonthStart              *NetWorthStart  `json:"monthStart"`
	MonthChange             *NetWorthChange `json:"monthChange"`
}

// NetWorthStart is the balances and Investments on Day (YYYY-MM-DD).
type NetWorthStart struct {
	Day              string `json:"day"`
	BalancesCents    int64  `json:"balancesCents"`
	InvestmentsCents int64  `json:"investmentsCents"`
}

// NetWorthChange is what changed since MonthStart; TotalCents = BalancesCents + InvestmentsCents.
type NetWorthChange struct {
	BalancesCents    int64 `json:"balancesCents"`
	InvestmentsCents int64 `json:"investmentsCents"`
	TotalCents       int64 `json:"totalCents"`
}

// NetWorthToday is today's Net worth with its parts: TotalCents = BalancesCents + InvestmentsCents - CardBillsCents.
type NetWorthToday struct {
	TotalCents       int64 `json:"totalCents"`
	BalancesCents    int64 `json:"balancesCents"`
	InvestmentsCents int64 `json:"investmentsCents"`
	CardBillsCents   int64 `json:"cardBillsCents"`
}

// NetWorthPoint is one day of the series.
type NetWorthPoint struct {
	Day   string `json:"day"`
	Cents int64  `json:"cents"`
}

// PastBill is one closed card bill of GET /me/finance/card-bills.
type PastBill struct {
	ClosesOn   string `json:"closesOn"` // YYYY-MM-DD
	DueOn      string `json:"dueOn"`
	TotalCents int64  `json:"totalCents"`
}

// PastCardBillsResponse is the answer of GET /me/finance/card-bills: the closed
// bills, oldest first, never null. AverageCents is over the bills returned (fewer
// than asked for when the bank sent fewer), null when there are none.
type PastCardBillsResponse struct {
	SourceID     string     `json:"sourceId"`
	Bills        []PastBill `json:"bills"`
	AverageCents *int64     `json:"averageCents"`
}

// ManualCardRequest is the body of POST /me/finance/manual-cards and PUT /me/finance/manual-cards/{id}.
// PixRecipient is the name as it appears on the Pix receipt; empty or absent clears it. Bills maps
// YYYY-MM to a total in cents: null deletes that month, an absent month is kept.
type ManualCardRequest struct {
	Name         string            `json:"name"`
	DueDay       int               `json:"dueDay"`
	PixRecipient *string           `json:"pixRecipient"`
	Bills        map[string]*int64 `json:"bills"`
}

// ManualCardResponse is a manual card with every typed month. PixRecipient is null when none;
// Bills is never null.
type ManualCardResponse struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	DueDay       int              `json:"dueDay"`
	PixRecipient *string          `json:"pixRecipient"`
	Bills        map[string]int64 `json:"bills"`
}
