package finance

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

func TestToRowsFilters(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	tx := func(id, status, cur string, m *pluggy.CreditCardMetadata) pluggy.Transaction {
		return pluggy.Transaction{ID: id, Date: d, Description: "x", AmountCents: -100, Currency: cur, Status: status, CreditCardMetadata: m}
	}
	rows, skipped := toRows([]pluggy.Transaction{
		tx("posted", "POSTED", "BRL", nil),
		tx("pending", "PENDING", "BRL", nil),
		tx("usd", "POSTED", "USD", nil),
		tx("zero", "POSTED", "BRL", &pluggy.CreditCardMetadata{InstallmentNumber: 0, TotalInstallments: 3}),
		tx("over", "POSTED", "BRL", &pluggy.CreditCardMetadata{InstallmentNumber: 4, TotalInstallments: 3}),
		tx("ok", "POSTED", "BRL", &pluggy.CreditCardMetadata{InstallmentNumber: 2, TotalInstallments: 3}),
	})
	if skipped != 1 {
		t.Fatalf("skippedCurrency = %d, want 1", skipped)
	}
	if len(rows) != 4 {
		t.Fatalf("rows = %d, want 4 (posted, zero, over, ok)", len(rows))
	}
	for _, r := range rows {
		want := int32(0)
		if r.ProviderID == "ok" {
			want = 2
		}
		if r.InstallmentNumber != want {
			t.Errorf("%s InstallmentNumber = %d, want %d", r.ProviderID, r.InstallmentNumber, want)
		}
	}
}
