package finance

import (
	"reflect"
	"testing"
	"time"
)

func TestManualBillIn(t *testing.T) {
	t.Parallel()
	m := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s+"-01"); return v }
	typed := []ManualBill{{m("2026-11"), 119000}, {m("2027-01"), 0}, {m("2027-03"), 24800}}
	cases := map[string]struct {
		bills []ManualBill
		month string
		want  int64
	}{
		"an exact month":                 {typed, "2027-03", 24800},
		"a gap takes the earlier value":  {typed, "2026-12", 119000},
		"before the first typed month":   {typed, "2026-10", 0},
		"no values":                      {nil, "2026-11", 0},
		"a typed zero carries forward":   {typed, "2027-02", 0},
		"a later month never leaks back": {typed, "2027-01", 0},
		"after the last typed month":     {typed, "2027-09", 24800},
		"the first typed month":          {typed, "2026-11", 119000},
	}
	for name, c := range cases {
		if got := ManualBillIn(c.bills, m(c.month)); got != c.want {
			t.Errorf("%s: ManualBillIn(%s) = %d, want %d", name, c.month, got, c.want)
		}
	}
}

func TestOutlookManualCard(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	feb := d("2027-02-01")
	income := int64(500000)
	manual := []ManualCard{{ID: "m1", Name: "Fatura Naiara", DueDay: 31, Bills: []ManualBill{{d("2027-02-01"), 119000}, {d("2027-04-01"), 24800}}}}
	connected := []Card{{ID: "c1", Name: "Nubank", BillDaysKnown: true}}
	got := Outlook(nil, connected, manual, nil, [][]MonthBill{nil, nil, nil}, &income, nil, nil, 0, d("2027-02-10"), feb, 3)
	wantAmount := []int64{119000, 119000, 24800}
	wantDue := []string{"2027-02-28", "2027-03-31", "2027-04-30"}
	for i, o := range got {
		if len(o.Cards) != 2 || o.Cards[0].SourceID != "c1" || o.Cards[0].Manual {
			t.Fatalf("month %d cards = %+v, want the connected card then the manual one", i, o.Cards)
		}
		line := o.Cards[1]
		if line.SourceID != "m1" || line.Name != "Fatura Naiara" || !line.Manual || !line.BillDaysKnown || line.FromBank || line.ClosesOn != nil ||
			line.AmountCents != wantAmount[i] || line.DueOn == nil || line.DueOn.Format(time.DateOnly) != wantDue[i] {
			t.Errorf("month %d manual line = %+v, want amount %d due %s", i, line, wantAmount[i], wantDue[i])
		}
		if o.TotalCents != wantAmount[i] || o.LeftoverCents == nil || *o.LeftoverCents != income-wantAmount[i] {
			t.Errorf("month %d total = %d leftover = %v, want %d", i, o.TotalCents, o.LeftoverCents, wantAmount[i])
		}
	}
	if unpaid := UnpaidCardBills(connected, got, feb, d("2027-02-10")); !reflect.DeepEqual(unpaid, []int64{0}) {
		t.Errorf("UnpaidCardBills = %v, want only the connected card's bill", unpaid)
	}
}
