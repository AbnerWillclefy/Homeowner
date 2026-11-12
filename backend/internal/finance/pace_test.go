package finance

import (
	"slices"
	"testing"
	"time"
)

func cents(v int64) *int64 { return &v }

func day(s string) time.Time {
	v, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return v
}

func deref(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func TestDailyAllowance(t *testing.T) {
	t.Parallel()
	for name, c := range map[string]struct {
		leftover     *int64
		today, month string
		want         *int64
	}{
		"first day of a 31-day month":      {cents(310000), "2026-07-01", "2026-07-01", cents(10000)},
		"last day is the full leftover":    {cents(310000), "2026-07-31", "2026-07-01", cents(310000)},
		"no income":                        {nil, "2026-07-10", "2026-07-01", nil},
		"negative leftover stays negative": {cents(-310000), "2026-07-01", "2026-07-01", cents(-10000)},
		"rounds half up":                   {cents(5), "2026-07-30", "2026-07-01", cents(3)}, // 5/2
		"rounds a negative half up":        {cents(-5), "2026-07-30", "2026-07-01", cents(-2)},
		"past month":                       {cents(310000), "2026-08-05", "2026-07-01", nil},
		"future month":                     {cents(310000), "2026-07-05", "2026-08-01", nil},
		"same month number, other year":    {cents(310000), "2027-07-05", "2026-07-01", nil},
		"leap february last day":           {cents(777), "2028-02-29", "2028-02-01", cents(777)},
	} {
		got := DailyAllowance(c.leftover, day(c.today), day(c.month))
		if (got == nil) != (c.want == nil) || got != nil && *got != *c.want {
			t.Errorf("%s: DailyAllowance = %v, want %v", name, deref(got), deref(c.want))
		}
	}
}

func TestPace(t *testing.T) {
	t.Parallel()
	rows := []Txn{
		{Type: "expense", AmountCents: -1000, PostedOn: day("2026-07-01")},
		{Type: "expense", AmountCents: -500, PostedOn: day("2026-07-03")},
		{Type: "saving", AmountCents: -9999, PostedOn: day("2026-07-02")},   // left out of spending
		{Type: "transfer", AmountCents: -9999, PostedOn: day("2026-07-02")}, // left out too
	}
	full := make([]int64, 31)
	for i := range full {
		full[i] = 1000
		if i >= 2 {
			full[i] = 1500
		}
	}
	for name, c := range map[string]struct {
		income, leftover *int64
		today, month     string
		want             *PaceLine
	}{
		"current month stops at today": {cents(100000), cents(60000), "2026-07-03", "2026-07-01", &PaceLine{SpentCents: []int64{1000, 1000, 1500}, LineEndCents: 40000}},
		"past month holds all days":    {cents(100000), cents(60000), "2026-08-10", "2026-07-01", &PaceLine{SpentCents: full, LineEndCents: 40000}},
		"future month has none":        {cents(100000), cents(60000), "2026-06-10", "2026-07-01", nil},
		"no income":                    {nil, nil, "2026-07-03", "2026-07-01", nil},
		"negative leftover":            {cents(100000), cents(-5000), "2026-07-01", "2026-07-01", &PaceLine{SpentCents: []int64{1000}, LineEndCents: 105000}},
	} {
		got := Pace(rows, c.income, c.leftover, day(c.today), day(c.month))
		if (got == nil) != (c.want == nil) || got != nil && (got.LineEndCents != c.want.LineEndCents || !slices.Equal(got.SpentCents, c.want.SpentCents)) {
			t.Errorf("%s: Pace = %+v, want %+v", name, got, c.want)
		}
	}
}
