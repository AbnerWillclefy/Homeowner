package finance

import (
	"slices"
	"strings"
	"testing"
	"time"
)

// SuggestBills table: one row per condition of the "recurring" rule.
func TestSuggestBills(t *testing.T) {
	t.Parallel()
	day := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
	// charge is an Expense as a bank describes it.
	charge := func(desc string, cents int64, at time.Time) Txn {
		return Txn{ID: desc + at.String(), Description: desc, MerchantKey: MerchantKey(desc), PostedOn: at, AmountCents: -cents, Type: "expense"}
	}
	now := day(2026, time.November, 10) // the window is August, September, October
	three := func(desc string, a, b, c int64, d1, d2, d3 int) []Txn {
		return []Txn{charge(desc, a, day(2026, 8, d1)), charge(desc, b, day(2026, 9, d2)), charge(desc, c, day(2026, 10, d3))}
	}
	spotify3 := three("SPOTIFY", 2190, 2190, 2190, 8, 8, 8)
	withMiddle := func(f func(*Txn)) []Txn {
		txns := slices.Clone(spotify3)
		f(&txns[1])
		return txns
	}
	spotify := Suggestion{MerchantKey: "SPOTIFY", Name: "SPOTIFY", AmountCents: 2190, DueDay: 8}
	for name, c := range map[string]struct {
		txns      []Txn
		bills     []Bill
		dismissed map[string]bool
		now       time.Time
		want      []Suggestion
	}{
		"three months, same amount and day": {txns: spotify3, want: []Suggestion{spotify}},
		"two months":                        {txns: spotify3[1:]},
		"a gap month":                       {txns: []Txn{spotify3[0], spotify3[2], charge("SPOTIFY", 2190, day(2026, 7, 8))}},
		"the current month does not count":  {txns: []Txn{spotify3[1], spotify3[2], charge("SPOTIFY", 2190, day(2026, 11, 8))}},
		"plus 10% passes":                   {txns: three("SPOTIFY", 1000, 1000, 1100, 8, 8, 8), want: []Suggestion{{"SPOTIFY", "SPOTIFY", 1100, 8}}},
		"plus 11% fails":                    {txns: three("SPOTIFY", 1000, 1000, 1110, 8, 8, 8)},
		"5 days off passes":                 {txns: three("SPOTIFY", 2190, 2190, 2190, 8, 8, 13), want: []Suggestion{spotify}},
		"6 days off fails":                  {txns: three("SPOTIFY", 2190, 2190, 2190, 8, 8, 14)},
		"the largest charge of a month counts": {
			txns: append(slices.Clone(spotify3), charge("SPOTIFY", 300, day(2026, 9, 28))), want: []Suggestion{spotify}},
		"due days 28, 31, 30 pass the clamp": {
			now:  day(2027, time.May, 3),
			txns: []Txn{charge("ALUGUEL", 5000, day(2027, 2, 28)), charge("ALUGUEL", 5000, day(2027, 3, 31)), charge("ALUGUEL", 5000, day(2027, 4, 30))},
			want: []Suggestion{{"ALUGUEL", "ALUGUEL", 5000, 30}}},
		"due day 31 clamped in November": {
			now:  day(2027, time.February, 3),
			txns: []Txn{charge("ALUGUEL", 5000, day(2026, 11, 30)), charge("ALUGUEL", 5000, day(2026, 12, 31)), charge("ALUGUEL", 5000, day(2027, 1, 31))},
			want: []Suggestion{{"ALUGUEL", "ALUGUEL", 5000, 31}}},
		"across the year end": {
			now:  day(2027, time.January, 3),
			txns: []Txn{charge("SPOTIFY", 2190, day(2026, 10, 8)), charge("SPOTIFY", 2190, day(2026, 11, 8)), charge("SPOTIFY", 2190, day(2026, 12, 8))},
			want: []Suggestion{spotify}},
		"a refund is ignored":              {txns: withMiddle(func(t *Txn) { t.AmountCents = 2190 })},
		"a transfer is ignored":            {txns: withMiddle(func(t *Txn) { t.Type = "transfer" })},
		"income is ignored":                {txns: withMiddle(func(t *Txn) { t.Type = "income" })},
		"a linked charge is ignored":       {txns: withMiddle(func(t *Txn) { t.Linked = true })},
		"an installment charge is ignored": {txns: withMiddle(func(t *Txn) { t.Installment = true })},
		"a covered merchant":               {txns: spotify3, bills: []Bill{{ID: "b", Name: "spotify", ExpectedCents: 1}}},
		"a two-letter bill covers nothing": {txns: spotify3, bills: []Bill{{ID: "b", Name: "Sp"}}, want: []Suggestion{spotify}},
		"a dismissed merchant":             {txns: spotify3, dismissed: map[string]bool{"SPOTIFY": true}},
		"the name is a prefix the bank text contains": {
			txns: three("NETFLIX.COM", 3990, 3990, 3990, 5, 5, 5), want: []Suggestion{{"NETFLIX COM", "NETFLIX", 3990, 5}}},
		"a name under 3 characters": {txns: three("GÁ", 3990, 3990, 3990, 5, 5, 5)},
		"a name is cut to the words that fit 60": {
			txns: three(strings.Repeat("A", 55)+" BBBBBBBB", 100, 100, 100, 5, 5, 5),
			want: []Suggestion{{strings.Repeat("A", 55) + " BBBBBBBB", strings.Repeat("A", 55), 100, 5}}},
		"one word over 60 is not suggested": {txns: three(strings.Repeat("A", 61), 100, 100, 100, 5, 5, 5)},
		"ordered by due day then name": {
			txns: slices.Concat(three("ZETA", 100, 100, 100, 9, 9, 9), three("BETA", 100, 100, 100, 9, 9, 9), three("ALFA", 100, 100, 100, 20, 20, 20)),
			want: []Suggestion{{"BETA", "BETA", 100, 9}, {"ZETA", "ZETA", 100, 9}, {"ALFA", "ALFA", 100, 20}}},
	} {
		n := c.now
		if n.IsZero() {
			n = now
		}
		if got := SuggestBills(c.txns, c.bills, c.dismissed, n); !slices.Equal(got, c.want) {
			t.Errorf("%s: SuggestBills = %+v, want %+v", name, got, c.want)
		}
	}
}
