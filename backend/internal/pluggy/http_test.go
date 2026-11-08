package pluggy_test

import (
	"context"
	"errors"
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
	want := pluggy.Account{ID: pluggytest.CheckingAccountID, Type: "BANK", Subtype: "CHECKING_ACCOUNT", Name: "Conta Corrente", Currency: "BRL"}
	if accts[0] != want {
		t.Errorf("first account = %+v, want %+v", accts[0], want)
	}
	if accts[1].Type != "CREDIT" || accts[1].Subtype != "CREDIT_CARD" {
		t.Errorf("second account = %+v", accts[1])
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
	if err != nil || len(page2.Transactions) != 2 || page2.Next != "" {
		t.Fatalf("page 2: %d rows, next %q, err %v; want 2 rows and no cursor", len(page2.Transactions), page2.Next, err)
	}
	debit := page2.Transactions[0]
	if debit.AmountCents != -1234 || debit.Type != "DEBIT" || debit.Category != nil || debit.ProviderID != nil ||
		!debit.Date.Equal(time.Date(2026, 1, 15, 3, 0, 0, 0, time.UTC)) || debit.Currency != "BRL" || debit.Status != "POSTED" {
		t.Errorf("synthetic debit = %+v", debit)
	}
	if page2.Transactions[1].AmountCents != 10005 || *page2.Transactions[1].Category != "Transfers" {
		t.Errorf("synthetic credit = %+v", page2.Transactions[1])
	}
}

func TestListTransactionsCardKeepsPluggySign(t *testing.T) {
	t.Parallel()
	c := pluggy.NewHTTP(pluggytest.NewServer(t).URL)
	page, err := c.ListTransactions(context.Background(), pluggytest.APIKey, pluggytest.CardAccountID, time.Now(), time.Now(), "")
	if err != nil || len(page.Transactions) != 17 || page.Next != "" {
		t.Fatalf("card page: %d rows, next %q, err %v", len(page.Transactions), page.Next, err)
	}
	first := page.Transactions[0]
	if first.Description != "SPOTIFY AB" || first.AmountCents != -2190 || first.Type != "CREDIT" {
		t.Errorf("first card row = %+v; a purchase is negative with type CREDIT", first)
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
	_, err = c.ListTransactions(context.Background(), pluggytest.APIKey, pluggytest.CardAccountID, time.Now(), time.Now(), "")
	if err == nil || err.Error() != "pluggy: list transactions: status 502" || strings.Contains(err.Error(), pluggytest.FailBody) {
		t.Errorf("err = %v", err)
	}
}
