package finance

import (
	"reflect"
	"testing"
	"time"
)

func TestNetWorth(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		balances    []int64
		investments []int64
		cardBills   []int64
		want        NetWorthParts
	}{
		{"two sources, a hand and a bank investment, a card", []int64{100000, 50000}, []int64{20000, 7000}, []int64{30000, 5000},
			NetWorthParts{TotalCents: 142000, BalancesCents: 150000, InvestmentsCents: 27000, CardBillsCents: 35000}},
		{"a credit balance adds", []int64{1000}, nil, []int64{-400}, NetWorthParts{TotalCents: 1400, BalancesCents: 1000, CardBillsCents: -400}},
		{"nothing owned and a bill goes negative", nil, nil, []int64{500}, NetWorthParts{TotalCents: -500, CardBillsCents: 500}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := NetWorth(tc.balances, tc.investments, tc.cardBills)
			if got != tc.want {
				t.Errorf("NetWorth = %+v, want %+v", got, tc.want)
			}
			if got.TotalCents != got.BalancesCents+got.InvestmentsCents-got.CardBillsCents {
				t.Errorf("parts %+v do not add up", got)
			}
		})
	}
}

func TestUnpaidCardBills(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	from := d("2026-11-01")
	outlook := []MonthOutlook{
		{Cards: []CardBill{{SourceID: "a", AmountCents: 100}, {SourceID: "b", AmountCents: 7}}},
		{Cards: []CardBill{{SourceID: "a", AmountCents: 200}, {SourceID: "b", AmountCents: 9}}},
	}
	tests := []struct {
		name  string
		cards []Card
		today string
		want  []int64
	}{
		{"both months before their due days", []Card{{ID: "a", DueDay: 10}}, "2026-11-05", []int64{100, 200}},
		{"due today still counts", []Card{{ID: "a", DueDay: 10}}, "2026-11-10", []int64{100, 200}},
		{"the current month's bill counts past its due day: Outlook gives the one still to pay", []Card{{ID: "a", DueDay: 10}}, "2026-11-11", []int64{100, 200}},
		{"a reported due date wins over the due day", []Card{{ID: "a", DueDay: 10, Bills: []StoredBill{{DueOn: d("2026-11-20"), TotalCents: 100}}}}, "2026-11-15", []int64{100, 200}},
		{"no due day and no bill counts only the current month", []Card{{ID: "a"}}, "2026-11-30", []int64{100}},
		{"each card on its own", []Card{{ID: "a", DueDay: 10}, {ID: "b", DueDay: 3}}, "2026-11-05", []int64{100, 7, 200, 9}},
		{"a bill that has not opened yet is skipped", []Card{{ID: "a", CloseDay: 3, DueDay: 10}}, "2026-10-15", []int64{100}},
		{"a card the outlook lacks adds nothing", []Card{{ID: "z", DueDay: 10}}, "2026-11-05", nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := UnpaidCardBills(tc.cards, outlook, from, d(tc.today)); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("UnpaidCardBills = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestUnpaidCardBillsDueBeforeClose(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	// A card closing on the 28th and due on the 5th: the open bill is due two months on, and the current month's always counts.
	outlook := []MonthOutlook{{Cards: []CardBill{{SourceID: "a", AmountCents: 1}}}, {Cards: []CardBill{{SourceID: "a", AmountCents: 2}}}, {Cards: []CardBill{{SourceID: "a", AmountCents: 4}}}}
	got := UnpaidCardBills([]Card{{ID: "a", CloseDay: 28, DueDay: 5}}, outlook, d("2026-11-01"), d("2026-11-30"))
	if want := []int64{1, 2, 4}; !reflect.DeepEqual(got, want) {
		t.Errorf("UnpaidCardBills = %v, want %v", got, want)
	}
}

func TestNetWorthSeries(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	p := func(day string, v int64) Point[int64] { return Point[int64]{Day: d(day), Value: v} }
	pt := func(day string, c int64) SeriesPoint { return SeriesPoint{Day: d(day), Cents: c} }
	tests := []struct {
		name                  string
		balances, investments map[string][]Point[int64]
		from, to              string
		want                  []SeriesPoint
	}{
		{"carries a value across a gap", map[string][]Point[int64]{"s": {p("2026-11-01", 100), p("2026-11-04", 300)}}, nil, "2026-11-01", "2026-11-05",
			[]SeriesPoint{pt("2026-11-01", 100), pt("2026-11-02", 100), pt("2026-11-03", 100), pt("2026-11-04", 300), pt("2026-11-05", 300)}},
		{"nothing before the first stored value", map[string][]Point[int64]{"s": {p("2026-11-03", 100)}}, nil, "2026-11-01", "2026-11-04",
			[]SeriesPoint{pt("2026-11-03", 100), pt("2026-11-04", 100)}},
		{"a range longer than the history starts at the first point", map[string][]Point[int64]{"s": {p("2026-11-04", 5)}}, nil, "2026-01-01", "2026-11-04",
			[]SeriesPoint{pt("2026-11-04", 5)}},
		{"a value before the range carries into it", map[string][]Point[int64]{"s": {p("2026-10-01", 7)}}, nil, "2026-11-01", "2026-11-02",
			[]SeriesPoint{pt("2026-11-01", 7), pt("2026-11-02", 7)}},
		{"an investment counts from its first day", map[string][]Point[int64]{"s": {p("2026-11-01", 100)}}, map[string][]Point[int64]{"i": {p("2026-11-02", 40)}}, "2026-11-01", "2026-11-03",
			[]SeriesPoint{pt("2026-11-01", 100), pt("2026-11-02", 140), pt("2026-11-03", 140)}},
		{"no history gives no points", nil, nil, "2026-11-01", "2026-11-03", []SeriesPoint{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := NetWorthSeries(tc.balances, tc.investments, d(tc.from), d(tc.to)); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("NetWorthSeries = %v, want %v", got, tc.want)
			}
		})
	}
}
