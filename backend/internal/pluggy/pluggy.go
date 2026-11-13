// Package pluggy is the app's one view of the Pluggy API: a Client interface
// and the few types the app uses. NewHTTP is its only implementation; tests
// run it against pluggytest, never the real Pluggy.
package pluggy

import (
	"context"
	"errors"
	"time"
)

// ErrUnauthorized is a 401 or 403: the credentials or the API key were refused.
var ErrUnauthorized = errors.New("pluggy: unauthorized")

// ErrNotFound is a 404.
var ErrNotFound = errors.New("pluggy: not found")

// Client calls Pluggy. The API key is a parameter, never state: the caller
// holds it for as long as it needs it and drops it.
type Client interface {
	// Auth trades a Client ID and Secret for an API key.
	Auth(ctx context.Context, clientID, clientSecret string) (apiKey string, err error)
	CreateConnectToken(ctx context.Context, apiKey string) (string, error)
	GetItem(ctx context.Context, apiKey, itemID string) (Item, error)
	ListAccounts(ctx context.Context, apiKey, itemID string) ([]Account, error)
	// ListTransactions reads one page of an account's transactions. Pass an
	// empty cursor for the first page, then the previous page's Next until
	// Next is empty.
	ListTransactions(ctx context.Context, apiKey, accountID string, from, to time.Time, cursor string) (TransactionsPage, error)
	// ListBills reads a credit card account's bills, closed and open.
	ListBills(ctx context.Context, apiKey, accountID string) ([]Bill, error)
	// ListInvestments reads the Investments an Item holds.
	ListInvestments(ctx context.Context, apiKey, itemID string) ([]Investment, error)
}

// Investment is one holding as the bank reports it. ValueCents is Pluggy's
// balance; Type and Status are Pluggy's own words (MUTUAL_FUND, ACTIVE).
type Investment struct {
	ID, Name, Type, Currency, Status string
	ValueCents                       int64
}

// Bill is one bill of a credit card as the bank reports it. The dates are
// instants, like Transaction.Date.
type Bill struct {
	ID                   string
	DueDate, ClosingDate time.Time
	TotalCents           int64
	Currency             string
}

// Item is a connection to one institution.
type Item struct {
	ID     string
	Status string
}

// Account is one account of an Item. Type and Subtype are Pluggy's own words
// (BANK/CHECKING_ACCOUNT, CREDIT/CREDIT_CARD).
type Account struct {
	ID       string
	Type     string
	Subtype  string
	Name     string
	Currency string
	// CloseDay and DueDay are the days of the month a card's bill closes and
	// is due, from its current bill. They come as a pair: both are 0 when
	// Pluggy does not send both.
	CloseDay, DueDay int
	// Owner and TaxNumber are the account holder's name and CPF; both are
	// empty on a card.
	Owner, TaxNumber string
	// BalanceCents is the balance the bank reports. Nil means absent or unreadable.
	BalanceCents *int64
}

// Party is the other side of a Transaction. It lives in memory only: the sync
// reduces it to a boolean and never stores or logs it.
type Party struct {
	Name, Document string
}

// TransactionsPage is one page of transactions. Next is the cursor of the
// following page, empty on the last one.
type TransactionsPage struct {
	Transactions []Transaction
	Next         string
}

// Transaction is one row as Pluggy signs it: on a bank account negative is
// money out; on a credit card a purchase is positive and a bill payment
// negative. Type is never read. ProviderID is often missing, so key on ID.
type Transaction struct {
	ID          string
	ProviderID  *string
	Date        time.Time // an instant; convert to a São Paulo date before using it as a day
	Description string
	AmountCents int64
	Currency    string
	// AccountAmountCents is the amount in the account's currency (reais) of a foreign row, signed as AmountCents; nil when Pluggy sent none.
	AccountAmountCents *int64
	Type               string // DEBIT or CREDIT
	Status             string
	Category           *string // Pluggy's category, null on some rows
	CreditCardMetadata *CreditCardMetadata
	// Counterpart is the payment's receiver when the amount is negative and its
	// payer when positive; nil without paymentData.
	Counterpart *Party
}

// CreditCardMetadata is what Pluggy knows of an installment purchase.
type CreditCardMetadata struct {
	InstallmentNumber int
	TotalInstallments int
}
