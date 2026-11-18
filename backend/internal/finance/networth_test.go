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

// A card closing on the 28th and due on the 5th has its current month's bill due next month, so each
// later month holds the bill due one month after its own.
func TestUnpaidCardBillsShiftedMonths(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	due := d("2026-12-05")
	outlook := []MonthOutlook{
		{Cards: []CardBill{{SourceID: "a", AmountCents: 1}}, Cycles: map[string]BillCycle{"a": {DueOn: &due}}},
		{Cards: []CardBill{{SourceID: "a", AmountCents: 2}}},
		{Cards: []CardBill{{SourceID: "a", AmountCents: 4}}},
	}
	cards := []Card{{ID: "a", CloseDay: 28, DueDay: 5}}
	for name, c := range map[string]struct {
		today string
		want  []int64
	}{
		// The December slot holds the bill due 5 January, which has not opened: only installments.
		"the open bill is due next month: the bill after it is skipped": {"2026-11-17", []int64{1}},
		// On the 30th the closed bill is due 5 December and the open one 5 January, which still counts.
		"a closed bill due next month: the open one after it counts": {"2026-11-30", []int64{1, 2}},
	} {
		if got := UnpaidCardBills(cards, outlook, d("2026-11-01"), d(c.today)); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: UnpaidCardBills = %v, want %v", name, got, c.want)
		}
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

func TestMonthStart(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	p := func(day string, v int64) Point[int64] { return Point[int64]{Day: d(day), Value: v} }
	type m = map[string][]Point[int64]
	tests := []struct {
		name                  string
		balances, investments m
		want                  *MonthStartParts
	}{
		{"the last value on or before the start day", m{"s": {p("2026-10-01", 5), p("2026-10-31", 100), p("2026-11-04", 900)}}, nil, &MonthStartParts{100, 0}},
		{"a value exactly on the start day", m{"s": {p("2026-10-31", 70)}}, m{"i": {p("2026-10-31", 30)}}, &MonthStartParts{70, 30}},
		{"a Source first seen this month starts at its first value", m{"a": {p("2026-10-20", 100)}, "b": {p("2026-11-05", 400), p("2026-11-07", 450)}}, nil, &MonthStartParts{500, 0}},
		{"an Investment created this month starts at its first value", m{"s": {p("2026-10-31", 10)}}, m{"i": {p("2026-11-02", 60), p("2026-11-06", 80)}}, &MonthStartParts{10, 60}},
		{"no values at all", nil, nil, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := MonthStart(tc.balances, tc.investments, d("2026-10-31")); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("MonthStart = %v, want %v", got, tc.want)
			}
		})
	}
}
