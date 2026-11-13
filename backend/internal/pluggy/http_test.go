package pluggy_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy/pluggytest"
)

func TestAuthAndConnectToken(t *testing.T) {
	t.Parallel()
	c := pluggy.NewHTTP(pluggytest.NewServer(t).URL)
	ctx := context.Background()

	key, err := c.Auth(ctx, pluggytest.ClientID, pluggytest.ClientSecret)
	if err != nil || key != pluggytest.APIKey {
		t.Fatalf("Auth = %q, %v", key, err)
	}
	if _, err := c.Auth(ctx, pluggytest.ClientID, "wrong"); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Errorf("wrong secret: err = %v, want ErrUnauthorized", err)
	}
	if tok, err := c.CreateConnectToken(ctx, key); err != nil || tok != pluggytest.ConnectToken {
		t.Errorf("CreateConnectToken = %q, %v", tok, err)
	}
	if _, err := c.CreateConnectToken(ctx, "stale"); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Errorf("stale key: err = %v, want ErrUnauthorized", err)
	}
}

func TestItemAndAccounts(t *testing.T) {
	t.Parallel()
	c := pluggy.NewHTTP(pluggytest.NewServer(t).URL)
	ctx := context.Background()

	item, err := c.GetItem(ctx, pluggytest.APIKey, pluggytest.ItemID)
	if err != nil || item.ID != pluggytest.ItemID || item.Status != "UPDATED" {
		t.Fatalf("GetItem = %+v, %v", item, err)
	}
	if _, err := c.GetItem(ctx, pluggytest.APIKey, pluggytest.UnknownItemID); !errors.Is(err, pluggy.ErrNotFound) {
		t.Errorf("unknown item: err = %v, want ErrNotFound", err)
	}
	accts, err := c.ListAccounts(ctx, pluggytest.APIKey, pluggytest.ItemID)
	if err != nil || len(accts) != 2 {
		t.Fatalf("ListAccounts = %+v, %v", accts, err)
	}
	want := pluggy.Account{ID: pluggytest.CheckingAccountID, Type: "BANK", Subtype: "CHECKING_ACCOUNT", Name: "Conta Corrente", Currency: "BRL", Owner: "John Doe", TaxNumber: "416.799.495-00"}
	if b := accts[0].BalanceCents; b == nil || *b != 4370143 {
		t.Errorf("checking balance = %v, want 4370143", b)
	}
	if b := accts[1].BalanceCents; b == nil || *b != -91630 {
		t.Errorf("card balance = %v, want -91630", b)
	}
	accts[0].BalanceCents = nil
	if accts[0] != want {
		t.Errorf("first account = %+v, want %+v", accts[0], want)
	}
	// The card's bill closes on the 7th and is due on the 12th (creditData's dates).
	if accts[1].Type != "CREDIT" || accts[1].Subtype != "CREDIT_CARD" || accts[1].CloseDay != 7 || accts[1].DueDay != 12 {
		t.Errorf("second account = %+v", accts[1])
	}
}

// A lone day is no pair: the adapter reports neither, so a sync never stores half a bill.
func TestListAccountsKeepsABillDayOnlyWithItsPair(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name, credit string
		close, due   int
	}{
		{"both", `"balanceCloseDate":"2026-11-07","balanceDueDate":"2026-11-12"`, 7, 12},
		{"only the closing date", `"balanceCloseDate":"2026-11-07"`, 0, 0},
		{"only the due date", `"balanceDueDate":"2026-11-12"`, 0, 0},
		{"neither", `"level":"BLACK"`, 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				fmt.Fprintf(w, `{"results":[{"id":"a","type":"CREDIT","subtype":"CREDIT_CARD","name":"Card","currencyCode":"BRL","creditData":{%s}}]}`, tc.credit)
			}))
			t.Cleanup(srv.Close)
			accts, err := pluggy.NewHTTP(srv.URL).ListAccounts(context.Background(), "key", "item")
			if err != nil || len(accts) != 1 || accts[0].CloseDay != tc.close || accts[0].DueDay != tc.due {
				t.Errorf("ListAccounts = %+v, %v, want close %d due %d", accts, err, tc.close, tc.due)
			}
		})
	}
}

func TestListTransactionsFollowsNext(t *testing.T) {
	t.Parallel()
	c := pluggy.NewHTTP(pluggytest.NewServer(t).URL)
	ctx := context.Background()
	from, to := time.Date(2025, 11, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)

	page1, err := c.ListTransactions(ctx, pluggytest.APIKey, pluggytest.CheckingAccountID, from, to, "")
	if err != nil || len(page1.Transactions) != 31 || page1.Next == "" {
		t.Fatalf("page 1: %d rows, next %q, err %v; want 31 rows and a cursor", len(page1.Transactions), page1.Next, err)
	}
	page2, err := c.ListTransactions(ctx, pluggytest.APIKey, pluggytest.CheckingAccountID, from, to, page1.Next)
	if err != nil || len(page2.Transactions) != 4 || page2.Next != "" {
		t.Fatalf("page 2: %d rows, next %q, err %v; want 4 rows and no cursor", len(page2.Transactions), page2.Next, err)
	}
	debit := page2.Transactions[0]
	if debit.AmountCents != -1234 || debit.Type != "DEBIT" || debit.Category != nil || debit.ProviderID != nil ||
		!debit.Date.Equal(time.Date(2026, 1, 15, 3, 0, 0, 0, time.UTC)) || debit.Currency != "BRL" || debit.Status != "POSTED" {
		t.Errorf("synthetic debit = %+v", debit)
	}
	if page2.Transactions[1].AmountCents != 10005 || *page2.Transactions[1].Category != "Transfers" {
		t.Errorf("synthetic credit = %+v", page2.Transactions[1])
	}
	if cp := page2.Transactions[2].Counterpart; cp == nil || cp.Document != "416.799.495-00" || cp.Name != "Receiver Secret Name" || page2.Transactions[0].Counterpart != nil {
		t.Errorf("counterpart of the own-name debit = %+v, want the receiver; none on the others", cp)
	}
	if cp := page2.Transactions[3].Counterpart; cp == nil || cp.Document != "416.799.495-00" || cp.Name != "Payer Secret Name" {
		t.Errorf("counterpart of the own-name credit = %+v, want the payer", cp)
	}
}

func TestListTransactionsCardKeepsPluggySign(t *testing.T) {
	t.Parallel()
	c := pluggy.NewHTTP(pluggytest.NewServer(t).URL)
	page, err := c.ListTransactions(context.Background(), pluggytest.APIKey, pluggytest.CardAccountID, time.Date(2025, 11, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC), "")
	if err != nil || len(page.Transactions) != 17 || page.Next != "" {
		t.Fatalf("card page: %d rows, next %q, err %v", len(page.Transactions), page.Next, err)
	}
	first := page.Transactions[0]
	if first.Description != "SPOTIFY AB" || first.AmountCents != 2190 {
		t.Errorf("first card row = %+v; Pluggy signs a card purchase positive", first)
	}
	var inst *pluggy.Transaction
	for i, tx := range page.Transactions {
		if tx.CreditCardMetadata != nil {
			inst = &page.Transactions[i]
		}
	}
	if inst == nil || inst.CreditCardMetadata.InstallmentNumber != 2 || inst.CreditCardMetadata.TotalInstallments != 6 {
		t.Errorf("installment row = %+v", inst)
	}
}

func TestListBillsReadsTheCapture(t *testing.T) {
	t.Parallel()
	srv := pluggytest.NewServer(t)
	c := pluggy.NewHTTP(srv.URL)

	bills, err := c.ListBills(context.Background(), pluggytest.APIKey, pluggytest.CardAccountID)
	if err != nil || len(bills) != 2 {
		t.Fatalf("ListBills = %+v, %v", bills, err)
	}
	got := bills[0]
	if got.ID != "0d474e08-cc45-4cc4-ada1-578a0646c6ce" || got.TotalCents != 500000 || got.Currency != "BRL" ||
		!got.DueDate.Equal(time.Date(2023, 7, 31, 3, 0, 0, 0, time.UTC)) ||
		!got.ClosingDate.Equal(time.Date(2023, 7, 24, 3, 0, 0, 0, time.UTC)) || bills[1].TotalCents != 300000 {
		t.Errorf("bills = %+v", bills)
	}
	none, err := c.ListBills(context.Background(), pluggytest.APIKey, pluggytest.CheckingAccountID)
	if err != nil || len(none) != 0 {
		t.Errorf("checking account bills = %+v, %v, want none", none, err)
	}
}

func TestListBillsFailures(t *testing.T) {
	t.Parallel()
	srv := pluggytest.NewServer(t)
	if _, err := pluggy.NewHTTP(srv.URL).ListBills(context.Background(), "wrong", pluggytest.CardAccountID); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Errorf("wrong key err = %v, want ErrUnauthorized", err)
	}
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"results":[{"id":"b","dueDate":"2026-01-10T03:00:00.000Z","billClosingDate":"2026-01-03T03:00:00.000Z","totalAmount":1e3,"totalAmountCurrencyCode":"BRL"}]}`)
	}))
	t.Cleanup(bad.Close)
	if _, err := pluggy.NewHTTP(bad.URL).ListBills(context.Background(), "key", "a"); err == nil || err.Error() != "pluggy: list bills: unreadable amount" {
		t.Errorf("err = %v", err)
	}
}

func TestListBillsRoundsAThirdDecimalAndSkipsABillWithoutTotal(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"results":[`+
			`{"id":"up","dueDate":"2026-01-10T03:00:00.000Z","billClosingDate":"2026-01-03T03:00:00.000Z","totalAmount":2056.885,"totalAmountCurrencyCode":"BRL"},`+
			`{"id":"down","dueDate":"2026-02-10T03:00:00.000Z","billClosingDate":"2026-02-03T03:00:00.000Z","totalAmount":-117.8349999,"totalAmountCurrencyCode":"BRL"},`+
			`{"id":"none","dueDate":"2026-03-10T03:00:00.000Z","billClosingDate":"2026-03-03T03:00:00.000Z","totalAmount":null,"totalAmountCurrencyCode":"BRL"}]}`)
	}))
	t.Cleanup(srv.Close)
	bills, err := pluggy.NewHTTP(srv.URL).ListBills(context.Background(), "key", "a")
	if err != nil || len(bills) != 2 || bills[0].TotalCents != 205689 || bills[1].TotalCents != -11783 {
		t.Errorf("ListBills = %+v, %v; want 205689 and -11783, the bill without a total left out", bills, err)
	}
}

func TestFailuresCarryNoBody(t *testing.T) {
	t.Parallel()
	srv := pluggytest.NewServer(t)
	c := pluggy.NewHTTP(srv.URL)
	srv.Fail("/accounts", 500)
	srv.Fail("/v2/transactions", 502)

	_, err := c.ListAccounts(context.Background(), pluggytest.APIKey, pluggytest.ItemID)
	if err == nil || err.Error() != "pluggy: list accounts: status 500" {
		t.Errorf("err = %v", err)
	}
	_, err = c.ListTransactions(context.Background(), pluggytest.APIKey, pluggytest.CardAccountID, time.Date(2025, 11, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC), "")
	if err == nil || err.Error() != "pluggy: list transactions: status 502" || strings.Contains(err.Error(), pluggytest.FailBody) {
		t.Errorf("err = %v", err)
	}
}

func TestListInvestmentsReadsTheCapture(t *testing.T) {
	t.Parallel()
	srv := pluggytest.NewServer(t)
	c := pluggy.NewHTTP(srv.URL)

	invs, err := c.ListInvestments(context.Background(), pluggytest.APIKey, pluggytest.ItemID)
	if err != nil || len(invs) != 8 {
		t.Fatalf("ListInvestments = %+v, %v", invs, err)
	}
	if got := invs[0]; got.ID != "00000000-0000-4000-8000-000000000d01" || got.Name != "Fondo de Investimento Premium" ||
		got.ValueCents != 135939 || got.Currency != "BRL" || got.Type != "MUTUAL_FUND" || got.Status != "ACTIVE" {
		t.Errorf("first = %+v", got)
	}
	none, err := c.ListInvestments(context.Background(), pluggytest.APIKey, pluggytest.EmptyItemID)
	if err != nil || len(none) != 0 {
		t.Errorf("empty Item = %+v, %v, want none", none, err)
	}
	if _, err := c.ListInvestments(context.Background(), "wrong", pluggytest.ItemID); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Errorf("wrong key err = %v, want ErrUnauthorized", err)
	}
}

func TestListTransactionsReadsTheAmountInAccountCurrency(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"results":[`+
			`{"id":"usd","date":"2026-11-07T16:36:17.000Z","amount":5.19,"currencyCode":"USD","amountInAccountCurrency":29.98},`+
			`{"id":"brl","date":"2026-11-07T16:36:17.000Z","amount":10,"currencyCode":"BRL","amountInAccountCurrency":null}],"next":null}`)
	}))
	t.Cleanup(srv.Close)
	page, err := pluggy.NewHTTP(srv.URL).ListTransactions(context.Background(), "key", "a", time.Time{}, time.Time{}, "")
	if err != nil || len(page.Transactions) != 2 {
		t.Fatalf("page = %+v, %v", page, err)
	}
	if got := page.Transactions[0].AccountAmountCents; got == nil || *got != 2998 {
		t.Errorf("usd AccountAmountCents = %v, want 2998", got)
	}
	if got := page.Transactions[1].AccountAmountCents; got != nil {
		t.Errorf("brl AccountAmountCents = %v, want nil", *got)
	}
}
