package finance

import (
	"reflect"
	"testing"
	"time"
)

func TestOutlook(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	nov := d("2026-11-01")
	i64 := func(v int64) *int64 { return &v }
	spend := func(card, day string, cents int64) Txn {
		return Txn{SourceID: card, PostedOn: d(day), AmountCents: -cents, Type: "expense"}
	}
	bill := func(id string, cents int64, paid, byCard bool) MonthBill {
		return MonthBill{BillResponse: BillResponse{ID: id, Name: id, ExpectedCents: cents}, Paid: paid, CardPaid: byCard}
	}
	one := func(card string, known bool) []Card { return []Card{{ID: card, Name: card, BillDaysKnown: known}} }
	type want struct {
		cards    []CardBill // month 0
		next     []CardBill // month 1, checked when set
		other    []OtherBill
		otherIns int64
		total    int64
		leftover *int64
	}
	for name, c := range map[string]struct {
		rows      []Txn
		cards     []Card
		plans     []Plan
		bills     []MonthBill
		nextBills []MonthBill // month 1, checked when set
		income    *int64
		want      want
	}{
		"charges land in the month they count on": {
			rows:  []Txn{spend("a", "2026-11-03", 1000), spend("a", "2026-12-03", 400)},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 1000, true}}, next: []CardBill{{"a", "a", 400, true}}, total: 1000},
		},
		"a refund lowers the bill": {
			rows:  []Txn{spend("a", "2026-11-03", 1000), {SourceID: "a", PostedOn: d("2026-11-04"), AmountCents: 300, Type: "expense"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 700, true}}, total: 700},
		},
		"a bill payment transfer never counts": {
			rows:  []Txn{spend("a", "2026-11-03", 1000), {SourceID: "a", PostedOn: d("2026-11-05"), AmountCents: 1000, Type: "transfer"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 1000, true}}, total: 1000},
		},
		"a refund heavy month is negative": {
			rows:  []Txn{{SourceID: "a", PostedOn: d("2026-11-04"), AmountCents: 300, Type: "expense"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", -300, true}}, total: -300},
		},
		"a card with nothing has a zero bill": {
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 0, true}}},
		},
		"two cards each get their own bill and other sources are not cards": {
			rows:  []Txn{spend("a", "2026-11-03", 100), spend("b", "2026-11-03", 200), spend("checking", "2026-11-03", 999)},
			cards: []Card{{"a", "a", true}, {"b", "b", true}},
			want:  want{cards: []CardBill{{"a", "a", 100, true}, {"b", "b", 200, true}}, total: 300},
		},
		"a card without bill days is flagged": {
			rows:  []Txn{spend("a", "2026-11-03", 100)},
			cards: one("a", false),
			want:  want{cards: []CardBill{{"a", "a", 100, false}}, total: 100},
		},
		"a charged installment counts once and later ones are projected": {
			rows:  []Txn{spend("a", "2026-11-05", 2500)},
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 3, Total: 10, AmountCents: 2500, Month: nov, SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 2500, true}}, next: []CardBill{{"a", "a", 2500, true}}, total: 2500},
		},
		"a charge on a bill not yet due is not projected again": {
			rows:  []Txn{spend("a", "2026-12-05", 2500)},
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 3, Total: 3, AmountCents: 2500, Month: d("2026-12-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 0, true}}, next: []CardBill{{"a", "a", 2500, true}}},
		},
		"a plan whose latest charge is months old still owes from the asked month on": {
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 1, Total: 4, AmountCents: 100, Month: d("2026-09-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 100, true}}, next: []CardBill{{"a", "a", 100, true}}, total: 100},
		},
		"other bills: a paid one at its snapshot and a card paid one left out": {
			cards: one("a", true),
			bills: []MonthBill{bill("rent", 5000, true, false), bill("gym", 300, false, false), bill("netflix", 50, true, true)},
			want: want{cards: []CardBill{{"a", "a", 0, true}}, next: []CardBill{{"a", "a", 0, true}},
				other: []OtherBill{{"rent", "rent", 5000, true}, {"gym", "gym", 300, false}}, total: 5300},
		},
		"a card paid bill is dropped only for its own month": {
			cards:     one("a", true),
			bills:     []MonthBill{bill("netflix", 50, true, true)},
			nextBills: []MonthBill{bill("netflix", 50, false, false)},
			want:      want{cards: []CardBill{{"a", "a", 0, true}}},
		},
		"no income leaves the leftover absent": {
			rows: []Txn{spend("a", "2026-11-03", 100)}, cards: one("a", true),
			want: want{cards: []CardBill{{"a", "a", 100, true}}, total: 100},
		},
		"income above the total leaves the rest": {
			rows: []Txn{spend("a", "2026-11-03", 400)}, cards: one("a", true), income: i64(1000),
			want: want{cards: []CardBill{{"a", "a", 400, true}}, total: 400, leftover: i64(600)},
		},
		"a total above the income is a negative leftover": {
			rows: []Txn{spend("a", "2026-11-03", 1500)}, cards: one("a", true), income: i64(1000),
			want: want{cards: []CardBill{{"a", "a", 1500, true}}, total: 1500, leftover: i64(-500)},
		},
	} {
		got := Outlook(c.rows, c.cards, c.plans, [][]MonthBill{c.bills, c.nextBills}, c.income, nov, 2)
		m := got[0]
		if !reflect.DeepEqual(m.Cards, c.want.cards) || !reflect.DeepEqual(m.OtherBills, append([]OtherBill{}, c.want.other...)) ||
			m.OtherInstallmentsCents != c.want.otherIns || m.TotalCents != c.want.total || !reflect.DeepEqual(m.LeftoverCents, c.want.leftover) {
			t.Errorf("%s: month 0 = %+v, want %+v", name, m, c.want)
		}
		if c.want.next != nil && !reflect.DeepEqual(got[1].Cards, c.want.next) {
			t.Errorf("%s: month 1 cards = %+v, want %+v", name, got[1].Cards, c.want.next)
		}
		if c.nextBills != nil && !reflect.DeepEqual(got[1].OtherBills, []OtherBill{{"netflix", "netflix", 50, false}}) {
			t.Errorf("%s: month 1 other bills = %+v, want the unpaid one", name, got[1].OtherBills)
		}
	}
}

func TestOutlookCountsAnOtherSourcePlanInTheTotal(t *testing.T) {
	t.Parallel()
	nov := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	plans := []Plan{{Name: "Sofa", Number: 1, Total: 3, AmountCents: 900, Month: nov, SourceID: "x"}}
	got := Outlook(nil, nil, plans, [][]MonthBill{nil, nil, nil}, nil, nov, 3)
	if got[0].OtherInstallmentsCents != 0 || got[1].OtherInstallmentsCents != 900 || got[1].TotalCents != 900 || got[2].OtherInstallmentsCents != 900 {
		t.Errorf("outlook = %+v, want 900 in months 1 and 2 only", got)
	}
}
