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
		return Txn{SourceID: card, PostedOn: d(day), Posted: d(day), AmountCents: -cents, Type: "expense"}
	}
	// counted is a charge posted on one day that counts in the bill of another.
	counted := func(card, posted, countsOn string, cents int64) Txn {
		return Txn{SourceID: card, PostedOn: d(countsOn), Posted: d(posted), AmountCents: -cents, Type: "expense"}
	}
	stored := func(closes, due string, cents int64) StoredBill {
		return StoredBill{ClosesOn: d(closes), DueOn: d(due), TotalCents: cents}
	}
	withBills := func(card string, bills ...StoredBill) []Card {
		return []Card{{ID: card, Name: card, BillDaysKnown: true, Bills: bills}}
	}
	bill := func(id string, cents int64, paid, byCard bool) MonthBill {
		return MonthBill{BillResponse: BillResponse{ID: id, Name: id, ExpectedCents: cents}, Paid: paid, CardPaid: byCard}
	}
	one := func(card string, known bool) []Card { return []Card{{ID: card, Name: card, BillDaysKnown: known}} }
	// fromBank is a card bill the bank reported, due on the given day and closed on 2026-11-03.
	fromBank := func(id string, cents int64, due string) CardBill {
		dd, cl := d(due), d("2026-11-03")
		return CardBill{id, id, cents, true, true, &dd, &cl}
	}
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
			want:  want{cards: []CardBill{{"a", "a", 1000, true, false, nil, nil}}, next: []CardBill{{"a", "a", 400, true, false, nil, nil}}, total: 1000},
		},
		"a refund lowers the bill": {
			rows:  []Txn{spend("a", "2026-11-03", 1000), {SourceID: "a", PostedOn: d("2026-11-04"), AmountCents: 300, Type: "expense"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 700, true, false, nil, nil}}, total: 700},
		},
		"a bill payment transfer never counts": {
			rows:  []Txn{spend("a", "2026-11-03", 1000), {SourceID: "a", PostedOn: d("2026-11-05"), AmountCents: 1000, Type: "transfer"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 1000, true, false, nil, nil}}, total: 1000},
		},
		"a refund heavy month is negative": {
			rows:  []Txn{{SourceID: "a", PostedOn: d("2026-11-04"), AmountCents: 300, Type: "expense"}},
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", -300, true, false, nil, nil}}, total: -300},
		},
		"a card with nothing has a zero bill": {
			cards: one("a", true),
			want:  want{cards: []CardBill{{"a", "a", 0, true, false, nil, nil}}},
		},
		"two cards each get their own bill and other sources are not cards": {
			rows:  []Txn{spend("a", "2026-11-03", 100), spend("b", "2026-11-03", 200), spend("checking", "2026-11-03", 999)},
			cards: []Card{{ID: "a", Name: "a", BillDaysKnown: true}, {ID: "b", Name: "b", BillDaysKnown: true}},
			want:  want{cards: []CardBill{{"a", "a", 100, true, false, nil, nil}, {"b", "b", 200, true, false, nil, nil}}, total: 300},
		},
		"a bill due in the month replaces the computed sum and the owed installments": {
			rows:  []Txn{spend("a", "2026-11-03", 1000)},
			cards: withBills("a", stored("2026-11-03", "2026-11-10", 5000)),
			plans: []Plan{{Name: "TV", Number: 3, Total: 10, AmountCents: 2500, Month: d("2026-10-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{fromBank("a", 5000, "2026-11-10")}, total: 5000},
		},
		"a credit balance bill lowers the month as the bank says": {
			cards: withBills("a", stored("2026-11-03", "2026-11-10", -700)),
			want:  want{cards: []CardBill{fromBank("a", -700, "2026-11-10")}, total: -700},
		},
		"the open month counts only charges posted on or after the latest closing, plus installments": {
			rows: []Txn{counted("a", "2026-10-02", "2026-11-10", 700), counted("a", "2026-10-03", "2026-11-10", 800),
				counted("a", "2026-10-05", "2026-11-10", 300)},
			cards: withBills("a", stored("2026-09-03", "2026-09-10", 1), stored("2026-10-03", "2026-10-10", 9999)),
			plans: []Plan{{Name: "TV", Number: 3, Total: 10, AmountCents: 250, Month: d("2026-10-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 1350, true, false, nil, nil}}, total: 1350},
		},
		"a bill due in a later month does not cut the open month": {
			rows:  []Txn{counted("a", "2026-10-02", "2026-11-10", 700)},
			cards: withBills("a", stored("2026-11-03", "2026-12-10", 9999)),
			want:  want{cards: []CardBill{{"a", "a", 700, true, false, nil, nil}}, next: []CardBill{fromBank("a", 9999, "2026-12-10")}, total: 700},
		},
		"the month after a bill counts only what posted after its closing": {
			rows:  []Txn{counted("a", "2026-11-02", "2026-12-10", 700), counted("a", "2026-11-05", "2026-12-10", 300)},
			cards: withBills("a", stored("2026-11-03", "2026-11-10", 5000)),
			want:  want{cards: []CardBill{fromBank("a", 5000, "2026-11-10")}, next: []CardBill{{"a", "a", 300, true, false, nil, nil}}, total: 5000},
		},
		"a card with bills and a card without each keep their own rule": {
			rows: []Txn{spend("a", "2026-11-03", 100), spend("b", "2026-11-03", 200)},
			cards: []Card{{ID: "a", Name: "a", BillDaysKnown: true, Bills: []StoredBill{stored("2026-11-03", "2026-11-10", 5000)}},
				{ID: "b", Name: "b", BillDaysKnown: true}},
			want: want{cards: []CardBill{fromBank("a", 5000, "2026-11-10"), {"b", "b", 200, true, false, nil, nil}}, total: 5200},
		},
		"a card without bill days is flagged": {
			rows:  []Txn{spend("a", "2026-11-03", 100)},
			cards: one("a", false),
			want:  want{cards: []CardBill{{"a", "a", 100, false, false, nil, nil}}, total: 100},
		},
		"a charged installment counts once and later ones are projected": {
			rows:  []Txn{spend("a", "2026-11-05", 2500)},
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 3, Total: 10, AmountCents: 2500, Month: nov, SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 2500, true, false, nil, nil}}, next: []CardBill{{"a", "a", 2500, true, false, nil, nil}}, total: 2500},
		},
		"a charge on a bill not yet due is not projected again": {
			rows:  []Txn{spend("a", "2026-12-05", 2500)},
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 3, Total: 3, AmountCents: 2500, Month: d("2026-12-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 0, true, false, nil, nil}}, next: []CardBill{{"a", "a", 2500, true, false, nil, nil}}},
		},
		"a plan whose latest charge is months old still owes from the asked month on": {
			cards: one("a", true),
			plans: []Plan{{Name: "TV", Number: 1, Total: 4, AmountCents: 100, Month: d("2026-09-01"), SourceID: "a", Card: true}},
			want:  want{cards: []CardBill{{"a", "a", 100, true, false, nil, nil}}, next: []CardBill{{"a", "a", 100, true, false, nil, nil}}, total: 100},
		},
		"other bills: a paid one at its snapshot and a card paid one left out": {
			cards: one("a", true),
			bills: []MonthBill{bill("rent", 5000, true, false), bill("gym", 300, false, false), bill("netflix", 50, true, true)},
			want: want{cards: []CardBill{{"a", "a", 0, true, false, nil, nil}}, next: []CardBill{{"a", "a", 0, true, false, nil, nil}},
				other: []OtherBill{{"rent", "rent", 5000, true}, {"gym", "gym", 300, false}}, total: 5300},
		},
		"a card paid bill is dropped only for its own month": {
			cards:     one("a", true),
			bills:     []MonthBill{bill("netflix", 50, true, true)},
			nextBills: []MonthBill{bill("netflix", 50, false, false)},
			want:      want{cards: []CardBill{{"a", "a", 0, true, false, nil, nil}}},
		},
		"no income leaves the leftover absent": {
			rows: []Txn{spend("a", "2026-11-03", 100)}, cards: one("a", true),
			want: want{cards: []CardBill{{"a", "a", 100, true, false, nil, nil}}, total: 100},
		},
		"income above the total leaves the rest": {
			rows: []Txn{spend("a", "2026-11-03", 400)}, cards: one("a", true), income: i64(1000),
			want: want{cards: []CardBill{{"a", "a", 400, true, false, nil, nil}}, total: 400, leftover: i64(600)},
		},
		"a total above the income is a negative leftover": {
			rows: []Txn{spend("a", "2026-11-03", 1500)}, cards: one("a", true), income: i64(1000),
			want: want{cards: []CardBill{{"a", "a", 1500, true, false, nil, nil}}, total: 1500, leftover: i64(-500)},
		},
	} {
		got := Outlook(c.rows, c.cards, c.plans, [][]MonthBill{c.bills, c.nextBills}, c.income, nil, nil, 0, time.Time{}, nov, 2)
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
	got := Outlook(nil, nil, plans, [][]MonthBill{nil, nil, nil}, nil, nil, nil, 0, time.Time{}, nov, 3)
	if got[0].OtherInstallmentsCents != 0 || got[1].OtherInstallmentsCents != 900 || got[1].TotalCents != 900 || got[2].OtherInstallmentsCents != 900 {
		t.Errorf("outlook = %+v, want 900 in months 1 and 2 only", got)
	}
}

func TestOutlookPlannedSpending(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	nov := d("2026-11-01")
	row := func(src, day, typ, cat string, cents int64, linked bool) Txn {
		return Txn{SourceID: src, PostedOn: d(day), AmountCents: -cents, Type: typ, Category: cat, Linked: linked}
	}
	card := []Card{{ID: "a", Name: "a", BillDaysKnown: true}}
	g := func(cents int64) []PlannedLine { return []PlannedLine{{"groceries", cents}} }
	i64 := func(v int64) *int64 { return &v }
	type month struct {
		planned  []PlannedLine
		off      *int64
		total    int64
		plannedC int64
	}
	for name, c := range map[string]struct {
		rows    []Txn
		plans   []Plan
		limits  map[string]int64
		current time.Time
		m0, m1  month
	}{
		"groceries on the card are planned only for the rest of the limit": {
			rows: []Txn{row("a", "2026-11-03", "expense", "groceries", 30000, false)}, limits: map[string]int64{"groceries": 100000}, current: nov,
			m0: month{g(70000), i64(0), 100000, 70000}, m1: month{g(100000), nil, 100000, 100000},
		},
		"a category with no limit is not planned": {
			rows: []Txn{row("a", "2026-11-03", "expense", "pets", 500, false)}, limits: map[string]int64{"groceries": 1000}, current: nov,
			m0: month{g(1000), i64(0), 1500, 1000}, m1: month{g(1000), nil, 1000, 1000},
		},
		"no limits plan nothing": {
			rows: []Txn{row("a", "2026-11-03", "expense", "pets", 500, false)}, current: nov,
			m0: month{[]PlannedLine{}, i64(0), 500, 0}, m1: month{[]PlannedLine{}, nil, 0, 0},
		},
		"a limit already exceeded plans zero, not less": {
			rows: []Txn{row("a", "2026-11-03", "expense", "groceries", 150000, false)}, limits: map[string]int64{"groceries": 100000}, current: nov,
			m0: month{g(0), i64(0), 150000, 0}, m1: month{g(100000), nil, 100000, 100000},
		},
		"an installment in a limited category lowers its planned amount": {
			plans:  []Plan{{Name: "TV", Number: 3, Total: 10, AmountCents: 30000, Month: nov, SourceID: "a", Card: true, Category: "groceries"}},
			limits: map[string]int64{"groceries": 50000}, current: nov,
			m0: month{g(50000), i64(0), 50000, 50000}, m1: month{g(20000), nil, 50000, 20000},
		},
		"an installment off the card lowers it too": {
			plans:  []Plan{{Name: "Sofa", Number: 1, Total: 3, AmountCents: 30000, Month: nov, SourceID: "x", Category: "groceries"}},
			limits: map[string]int64{"groceries": 50000}, current: nov,
			m0: month{g(50000), i64(0), 50000, 50000}, m1: month{g(20000), nil, 50000, 20000},
		},
		"a refund above the spend does not lift planned over the limit": {
			rows: []Txn{{SourceID: "a", PostedOn: d("2026-11-04"), AmountCents: 30000, Type: "expense", Category: "groceries"}}, limits: map[string]int64{"groceries": 100000}, current: nov,
			m0: month{g(100000), i64(0), 70000, 100000}, m1: month{g(100000), nil, 100000, 100000},
		},
		"the current month counts what was spent off the card, without Bill payments, transfers and income": {
			rows: []Txn{
				row("checking", "2026-11-02", "expense", "groceries", 20000, false),
				row("checking", "2026-11-03", "expense", "groceries", 50000, true), // paid a Bill
				row("checking", "2026-11-04", "transfer", "", 9000, false),
				{SourceID: "checking", PostedOn: d("2026-11-05"), AmountCents: 7000, Type: "income"},
			},
			limits: map[string]int64{"groceries": 100000}, current: nov,
			m0: month{g(30000), i64(20000), 50000, 30000}, m1: month{g(100000), nil, 100000, 100000},
		},
		"a refund off the card makes already spent negative": {
			rows:    []Txn{{SourceID: "checking", PostedOn: d("2026-11-04"), AmountCents: 3000, Type: "expense"}},
			current: nov,
			m0:      month{[]PlannedLine{}, i64(-3000), -3000, 0}, m1: month{[]PlannedLine{}, nil, 0, 0},
		},
		"a window without the current month has no already spent": {
			rows:   []Txn{row("checking", "2026-11-02", "expense", "groceries", 20000, false)},
			limits: map[string]int64{"groceries": 100000}, current: d("2026-10-01"),
			m0: month{g(80000), nil, 80000, 80000}, m1: month{g(100000), nil, 100000, 100000},
		},
	} {
		got := Outlook(c.rows, card, c.plans, [][]MonthBill{nil, nil}, nil, c.limits, nil, 0, c.current, nov, 2)
		for i, want := range []month{c.m0, c.m1} {
			m := got[i]
			if !reflect.DeepEqual(m.Planned, want.planned) || !reflect.DeepEqual(m.SpentOffCardCents, want.off) || m.PlannedCents != want.plannedC || m.TotalCents != want.total {
				t.Errorf("%s: month %d = planned %v (%d) off %v total %d, want %+v", name, i, m.Planned, m.PlannedCents, m.SpentOffCardCents, m.TotalCents, want)
			}
		}
	}
}

func TestOutlookSavingAndBaselinePlan(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	nov := d("2026-11-01")
	saving := func(cents int64) Txn {
		return Txn{SourceID: "checking", PostedOn: d("2026-11-04"), AmountCents: -cents, Type: "saving"}
	}
	card := []Card{{ID: "a", Name: "a", BillDaysKnown: true}}
	cardBuy := Txn{SourceID: "a", PostedOn: d("2026-11-03"), AmountCents: -300, Type: "expense", Category: "pets"}
	i64 := func(v int64) *int64 { return &v }
	none := []PlannedLine{}
	for name, c := range map[string]struct {
		rows         []Txn
		contribution int64
		last         map[string]int64
		limits       map[string]int64
		income       *int64
		saving       int64
		planned      []PlannedLine
		total        int64
		leftover     *int64
	}{
		"actual saving above the contribution counts the actual":       {rows: []Txn{saving(900)}, contribution: 500, saving: 900, planned: none, total: 900},
		"actual saving below the contribution counts the contribution": {rows: []Txn{saving(200)}, contribution: 500, saving: 500, planned: none, total: 500},
		"no contribution and no saving count nothing":                  {planned: none},
		"a Resgate larger than the Aplicacao clamps the actual at 0": {
			rows: []Txn{saving(100), {SourceID: "checking", PostedOn: d("2026-11-05"), AmountCents: 400, Type: "saving"}}, planned: none,
		},
		"a category without a limit plans its baseline": {
			last: map[string]int64{"pets": 700}, planned: []PlannedLine{{"pets", 700}}, total: 700,
		},
		"a limit beats the baseline": {
			limits: map[string]int64{"pets": 500}, last: map[string]int64{"pets": 700}, planned: []PlannedLine{{"pets", 500}}, total: 500,
		},
		"a negative baseline plans nothing": {last: map[string]int64{"pets": -50}, planned: none},
		"a card purchase counts once: in the bill, and out of the plan": {
			rows: []Txn{cardBuy}, last: map[string]int64{"pets": 700}, planned: []PlannedLine{{"pets", 400}}, total: 700,
		},
		"the leftover subtracts the saving, and is negative when the month takes more": {
			rows: []Txn{saving(900)}, income: i64(600), saving: 900, planned: none, total: 900, leftover: i64(-300),
		},
	} {
		got := Outlook(c.rows, card, nil, [][]MonthBill{nil}, c.income, c.limits, c.last, c.contribution, nov, nov, 1)[0]
		if got.SavingCents != c.saving || got.TotalCents != c.total || !reflect.DeepEqual(got.Planned, c.planned) || !reflect.DeepEqual(got.LeftoverCents, c.leftover) {
			t.Errorf("%s: saving %d total %d planned %v leftover %v", name, got.SavingCents, got.TotalCents, got.Planned, got.LeftoverCents)
		}
	}
}

func TestPlannedBaseline(t *testing.T) {
	cur := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	at := func(month time.Month, cents int64, category string, linked bool) Txn {
		return Txn{PostedOn: time.Date(2026, month, 10, 0, 0, 0, 0, time.UTC), AmountCents: -cents, Type: "expense", Category: category, Linked: linked}
	}
	tests := []struct {
		name string
		rows []Txn
		want map[string]int64
	}{
		{"no rows", nil, map[string]int64{}},
		{"a month without the category divides as 0", []Txn{at(8, 300, "Food", false), at(9, 300, "Food", false), at(10, 100, "Fun", false)}, map[string]int64{"Food": 200, "Fun": 33}},
		{"one month of history", []Txn{at(10, 500, "Food", false)}, map[string]int64{"Food": 500}},
		{"two months of history", []Txn{at(9, 500, "Food", false), at(10, 500, "Food", false)}, map[string]int64{"Food": 500}},
		{"a Linked-only month counts in the divisor, not the sum", []Txn{at(8, 600, "Food", false), at(9, 900, "Food", true)}, map[string]int64{"Food": 300}},
		{"current and older rows are ignored", []Txn{at(11, 900, "Food", false), at(7, 900, "Food", false), at(10, 300, "Food", false)}, map[string]int64{"Food": 300}},
		{"net negative stays negative", []Txn{at(10, -600, "Food", false)}, map[string]int64{"Food": -600}},
		{"half rounds up", []Txn{at(9, 5, "Food", false), at(10, 0, "Other", false)}, map[string]int64{"Food": 3, "Other": 0}},
		{"negative half rounds up", []Txn{at(9, -5, "Food", false), at(10, 0, "Other", false)}, map[string]int64{"Food": -2, "Other": 0}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := plannedBaseline(tt.rows, nil, nil, cur); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

// A registered Bill is already in the other Bills, so each month of the
// baseline leaves out the payment off the cards nearest its expected amount.
func TestPlannedBaselineLeavesOutRegisteredBills(t *testing.T) {
	t.Parallel()
	cur := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	at := func(source string, month time.Month, day int, cents int64, category string) Txn {
		return Txn{SourceID: source, PostedOn: time.Date(2026, month, day, 0, 0, 0, 0, time.UTC), AmountCents: -cents, Type: "expense", Category: category}
	}
	cards := []Card{{ID: "card"}}
	mortgage := Bill{ID: "m", Name: "Financiamento", ExpectedCents: 697600}
	power := Bill{ID: "p", Name: "Luz", ExpectedCents: 23856}
	tests := []struct {
		name  string
		rows  []Txn
		bills []Bill
		want  map[string]int64
	}{
		{"the nearest payment each month is the Bill's", []Txn{
			at("acc", 8, 31, 698137, "housing"), at("acc", 9, 29, 697769, "housing"), at("acc", 10, 29, 697542, "housing"), at("card", 8, 5, 7205, "housing"),
		}, []Bill{mortgage}, map[string]int64{"housing": 2402}},
		{"a payment more than a tenth away from the Bill stays", []Txn{
			at("acc", 8, 27, 26241, "household_bills"), at("acc", 9, 25, 26242, "household_bills"), at("acc", 10, 23, 21471, "household_bills"),
		}, []Bill{power}, map[string]int64{"household_bills": 8747}},
		{"a card charge never pays a Bill", []Txn{at("card", 10, 5, 23856, "household_bills")}, []Bill{power}, map[string]int64{"household_bills": 23856}},
		{"one payment per Bill and month, the nearest", []Txn{
			at("acc", 10, 5, 22000, "household_bills"), at("acc", 10, 6, 23000, "household_bills"),
		}, []Bill{power}, map[string]int64{"household_bills": 22000}},
		{"a Linked payment is already out and takes no other", []Txn{
			{SourceID: "acc", PostedOn: time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC), AmountCents: -23856, Type: "expense", Category: "household_bills", Linked: true},
			at("acc", 10, 6, 23000, "household_bills"),
		}, []Bill{power}, map[string]int64{"household_bills": 23000}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := plannedBaseline(tt.rows, cards, tt.bills, cur); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

// TestOutlookCurrentCardBill is the bill the Resident still has to pay in the
// month today is in: the latest closed one until it is paid or past due, then
// the open one. Card "a" closes on the 20th and is due on the 28th.
func TestOutlookCurrentCardBill(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	nov := d("2026-11-01")
	charge := func(posted string, cents int64) Txn {
		p := d(posted)
		return Txn{SourceID: "a", PostedOn: CountsOn(p, "credit_card", 20, 28), Posted: p, AmountCents: -cents, Type: "expense"}
	}
	nubank := func(posted string, cents int64) Txn { // closes on the 28th, due on the 5th
		p := d(posted)
		return Txn{SourceID: "a", PostedOn: CountsOn(p, "credit_card", 28, 5), Posted: p, AmountCents: -cents, Type: "expense"}
	}
	card := func(closeDay, dueDay int, bills ...StoredBill) []Card {
		return []Card{{ID: "a", Name: "a", CloseDay: closeDay, DueDay: dueDay, BillDaysKnown: closeDay > 0, Bills: bills}}
	}
	octBill := StoredBill{ClosesOn: d("2026-10-20"), DueOn: d("2026-10-27"), TotalCents: 475871}
	novBill := StoredBill{ClosesOn: d("2026-11-20"), DueOn: d("2026-11-28"), TotalCents: 273363}
	paidNov := novBill
	paidNov.Paid = true
	open := func(cents int64) CardBill { return CardBill{"a", "a", cents, true, false, nil, nil} }
	for name, c := range map[string]struct {
		today      string
		rows       []Txn
		cards      []Card
		plans      []Plan
		want, next CardBill
	}{
		"after a past due bill, the open one: charges since its closing": {
			today: "2026-11-13", rows: []Txn{charge("2026-10-19", 100), charge("2026-10-25", 200), charge("2026-11-10", 300)},
			cards: card(20, 28, octBill), want: open(500), next: open(0),
		},
		"the open bill adds the installments still to be charged": {
			today: "2026-11-13", rows: []Txn{charge("2026-11-10", 300)}, cards: card(20, 28, octBill),
			plans: []Plan{{Name: "TV", Number: 2, Total: 4, AmountCents: 50, Month: d("2026-10-01"), SourceID: "a", Card: true}},
			want:  open(350), next: open(50),
		},
		"a closed bill not yet paid counts the bank's total": {
			today: "2026-11-23", rows: []Txn{charge("2026-11-10", 300), charge("2026-11-21", 50)}, cards: card(20, 28, octBill, novBill),
			want: func() CardBill {
				due, cl := d("2026-11-28"), d("2026-11-20")
				return CardBill{"a", "a", 273363, true, true, &due, &cl}
			}(),
			next: open(50),
		},
		"a paid closed bill gives way to the open one": {
			today: "2026-11-23", rows: []Txn{charge("2026-11-10", 300), charge("2026-11-21", 50)}, cards: card(20, 28, octBill, paidNov),
			want: open(50), next: open(0),
		},
		"no bank bills: the open bill from the typed closing day": {
			today: "2026-11-13", rows: []Txn{nubank("2026-10-27", 100), nubank("2026-10-30", 200), nubank("2026-11-10", 300)},
			cards: card(28, 5), want: open(500), next: open(0),
		},
		"no bank bills: the closed bill until its typed due day, its installments already charged": {
			today: "2026-11-30", rows: []Txn{nubank("2026-10-27", 100), nubank("2026-10-30", 200), nubank("2026-11-29", 40)},
			plans: []Plan{{Name: "TV", Number: 2, Total: 3, AmountCents: 50, Month: d("2026-10-01"), SourceID: "a", Card: true}},
			cards: card(28, 5), want: open(200), next: open(0),
		},
		"a bank that has not reported the latest closing: the typed days": {
			today: "2026-11-23", rows: []Txn{charge("2026-10-25", 200), charge("2026-11-21", 50)}, cards: card(20, 28, octBill),
			want: open(200), next: open(50),
		},
		"no bank bills and no days: what counts in the month": {
			today: "2026-11-13", rows: []Txn{{SourceID: "a", PostedOn: d("2026-11-03"), Posted: d("2026-11-03"), AmountCents: -70, Type: "expense"}},
			cards: card(0, 0), want: CardBill{"a", "a", 70, false, false, nil, nil}, next: CardBill{"a", "a", 0, false, false, nil, nil},
		},
	} {
		got := Outlook(c.rows, c.cards, c.plans, [][]MonthBill{nil, nil}, nil, nil, nil, 0, d(c.today), nov, 2)
		if !reflect.DeepEqual(got[0].Cards, []CardBill{c.want}) || got[0].TotalCents != c.want.AmountCents {
			t.Errorf("%s: current = %+v total %d, want %+v", name, got[0].Cards, got[0].TotalCents, c.want)
		}
		if !reflect.DeepEqual(got[1].Cards, []CardBill{c.next}) {
			t.Errorf("%s: next month = %+v, want %+v", name, got[1].Cards, c.next)
		}
	}
}

// In the current month the planned rest of a category subtracts what the card
// bills shown already hold, even charges that count on a later due day.
func TestOutlookCurrentPlannedSubtractsTheShownBills(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	nov := d("2026-11-01")
	buy := func(card string, closeDay, dueDay int, posted string, cents int64) Txn {
		p := d(posted)
		return Txn{SourceID: card, PostedOn: CountsOn(p, "credit_card", closeDay, dueDay), Posted: p, AmountCents: -cents, Type: "expense", Category: "groceries"}
	}
	cards := []Card{
		{ID: "inter", Name: "inter", CloseDay: 20, DueDay: 28, BillDaysKnown: true},
		{ID: "nubank", Name: "nubank", CloseDay: 28, DueDay: 5, BillDaysKnown: true},
	}
	rows := []Txn{
		buy("inter", 20, 28, "2026-10-25", 300),
		buy("nubank", 28, 5, "2026-11-10", 200), // counts on 2026-12-05, inside Nubank's open bill
		{SourceID: "checking", PostedOn: d("2026-11-03"), Posted: d("2026-11-03"), AmountCents: -100, Type: "expense", Category: "groceries"},
	}
	got := Outlook(rows, cards, nil, [][]MonthBill{nil}, nil, map[string]int64{"groceries": 1000}, nil, 0, d("2026-11-13"), nov, 1)[0]
	if want := []PlannedLine{{"groceries", 400}}; !reflect.DeepEqual(got.Planned, want) {
		t.Errorf("planned = %v, want %v: the limit less the bills' 500 and the 100 off the card", got.Planned, want)
	}
}
