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
	}, false, pluggy.Party{})
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

// A card charge stays PENDING until its bill closes, so the open bill is only pending rows.
func TestToRowsKeepsPendingCardCharges(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	rows, _ := toRows([]pluggy.Transaction{
		{ID: "open", Date: d, Description: "x", AmountCents: 1000, Currency: "BRL", Status: "PENDING"},
	}, true, pluggy.Party{})
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want the pending card charge", len(rows))
	}
}

// A foreign card charge counts in reais when Pluggy converted it; otherwise it is left out and counted.
func TestToRowsTakesTheCardChargeInReais(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	brl := int64(2998)
	rows, skipped := toRows([]pluggy.Transaction{
		{ID: "converted", Date: d, Description: "x", AmountCents: 519, Currency: "USD", Status: "PENDING", AccountAmountCents: &brl},
		{ID: "unconverted", Date: d, Description: "x", AmountCents: 519, Currency: "USD", Status: "PENDING"},
	}, true, pluggy.Party{})
	if skipped != 1 || len(rows) != 1 || rows[0].AmountCents != -2998 {
		t.Errorf("rows = %+v, skipped %d; want the converted charge at -2998 and one skipped", rows, skipped)
	}
}

// Some banks send every installment of a new purchase on its date: each one after the lowest counts in its own later month.
func TestToRowsMovesInstallmentsSentTogetherToTheirMonths(t *testing.T) {
	d := time.Date(2026, 11, 8, 15, 0, 0, 0, time.UTC)
	inst := func(id string, n, m int, on time.Time) pluggy.Transaction {
		return pluggy.Transaction{ID: id, Date: on, Description: "AMAZONMKTPLC E-PETMARK", AmountCents: 8757, Currency: "BRL", Status: "PENDING",
			CreditCardMetadata: &pluggy.CreditCardMetadata{InstallmentNumber: n, TotalInstallments: m}}
	}
	rows, _ := toRows([]pluggy.Transaction{
		inst("p1", 1, 6, d), inst("p2", 2, 6, d), inst("p6", 6, 6, d),
		inst("old", 4, 4, time.Date(2026, 10, 22, 15, 0, 0, 0, time.UTC)),
	}, true, pluggy.Party{})
	want := map[string]string{"p1": "2026-11-08", "p2": "2026-12-08", "p6": "2027-04-08", "old": "2026-10-22"}
	for _, r := range rows {
		if got := r.PostedOn.Format(time.DateOnly); got != want[r.ProviderID] {
			t.Errorf("%s PostedOn = %s, want %s", r.ProviderID, got, want[r.ProviderID])
		}
	}
}

func TestToRowsFlipsCardSign(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	rows, _ := toRows([]pluggy.Transaction{
		{ID: "buy", Date: d, Description: "x", AmountCents: 1000, Currency: "BRL", Status: "POSTED"},
		{ID: "pay", Date: d, Description: "PAGAMENTO DE FATURA", AmountCents: -500, Currency: "BRL", Status: "POSTED"},
	}, true, pluggy.Party{})
	if rows[0].AmountCents != -1000 || rows[0].Type != "expense" || rows[1].AmountCents != 500 || rows[1].Type != "income" {
		t.Errorf("rows = %+v, want the purchase -1000 expense and the payment 500 income", rows)
	}
}
