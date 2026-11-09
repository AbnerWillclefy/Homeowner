package finance

import (
	"slices"
	"testing"
	"time"
)

func TestDueDate(t *testing.T) {
	t.Parallel()
	for name, c := range map[string]struct {
		year    int
		month   time.Month
		dueDay  int
		wantDay int
	}{
		"31 in February 2026": {2026, time.February, 31, 28},
		"31 in February 2028": {2028, time.February, 31, 29},
		"31 in April":         {2026, time.April, 31, 30},
		"31 in January":       {2026, time.January, 31, 31},
		"15 stays 15":         {2026, time.February, 15, 15},
		"31 in December":      {2026, time.December, 31, 31},
	} {
		got := DueDate(c.year, c.month, c.dueDay)
		if want := time.Date(c.year, c.month, c.wantDay, 0, 0, 0, 0, time.UTC); !got.Equal(want) {
			t.Errorf("%s: DueDate = %v, want %v", name, got, want)
		}
	}
}

func TestCountsOn(t *testing.T) {
	t.Parallel()
	d := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }
	for name, c := range map[string]struct {
		posted           string
		kind             Kind
		closeDay, dueDay int
		want             string
	}{
		"checking counts on posted":               {"2030-01-03", "checking", 7, 12, "2030-01-03"},
		"card with unknown days counts on posted": {"2030-01-03", "credit_card", 0, 0, "2030-01-03"},
		"before closing: this month's bill":       {"2030-01-03", "credit_card", 7, 12, "2030-01-12"},
		"on the closing day: next bill":           {"2030-01-07", "credit_card", 7, 12, "2030-02-12"},
		"due early next month":                    {"2030-01-20", "credit_card", 25, 5, "2030-02-05"},
		"after closing, due next month":           {"2030-01-26", "credit_card", 25, 5, "2030-03-05"},
		"closing 31 in February":                  {"2030-02-28", "credit_card", 31, 10, "2030-04-10"},
		"December into January":                   {"2029-12-10", "credit_card", 7, 12, "2030-01-12"},
	} {
		if got := CountsOn(d(c.posted), c.kind, c.closeDay, c.dueDay); !got.Equal(d(c.want)) {
			t.Errorf("%s: CountsOn = %s, want %s", name, got.Format(time.DateOnly), c.want)
		}
	}
}

func TestMerchantKey(t *testing.T) {
	t.Parallel()
	for in, want := range map[string]string{
		"NETFLIX.COM":                      "NETFLIX COM",
		"Pagamento de boleto":              "PAGAMENTO DE BOLETO",
		"SALÁRIO EMPRESA XYZ LTDA":         "SALARIO EMPRESA XYZ LTDA",
		"Mercado Livre PARC 03/10":         "MERCADO LIVRE",
		"MERCADOLIVRE*PARC03/10 SP":        "MERCADOLIVRE SP",
		"PIX*João  12345":                  "PIX JOAO",
		"  açaí &  café - Ñandú  ":         "ACAI CAFE NANDU",
		"CONDOMÍNIO ÂÊÔ ÃÕ ÀÈ ÏÜ Ç":        "CONDOMINIO AEO AO AE IU C",
		"SMART FIT ACADEMIA 0042 PARC 2/6": "SMART FIT ACADEMIA",
		"123 / 456 ---":                    "",
		"":                                 "",
	} {
		if got := MerchantKey(in); got != want {
			t.Errorf("MerchantKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPostedOnIsTheSaoPauloDay(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ utc, want string }{
		{"2026-11-07T03:00:00Z", "2026-11-07"}, // São Paulo midnight
		{"2026-11-07T02:59:59Z", "2026-11-06"}, // the evening before
		{"2026-11-07T17:21:33Z", "2026-11-07"},
		{"2026-11-08T01:00:00Z", "2026-11-07"},
	} {
		at, _ := time.Parse(time.RFC3339, c.utc)
		if got := postedOn(at).Format(time.DateOnly); got != c.want {
			t.Errorf("postedOn(%s) = %s, want %s", c.utc, got, c.want)
		}
	}
}

func TestMatchBills(t *testing.T) {
	t.Parallel()
	nov := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	oct := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	day := func(m time.Time, d int) time.Time { return m.AddDate(0, 0, d-1) }
	exp := func(id, desc string, cents int64, on time.Time) Txn {
		return Txn{ID: id, Description: desc, AmountCents: -cents, PostedOn: on, Type: "expense"}
	}
	rent := Bill{ID: "b1", Name: "Aluguel", ExpectedCents: 150000}
	for name, c := range map[string]struct {
		bills []Bill
		txns  []Txn
		taken map[billMonth]bool
		want  []Match
	}{
		"exact match":      {[]Bill{rent}, []Txn{exp("t1", "PIX Aluguel Nov", 150000, day(nov, 5))}, nil, []Match{{"b1", "t1", nov}}},
		"different amount": {[]Bill{rent}, []Txn{exp("t1", "ALUGUEL", 149999, day(nov, 5))}, nil, nil},
		"accents and case": {[]Bill{{ID: "b1", Name: "Água", ExpectedCents: 8000}}, []Txn{exp("t1", "pagto agua sabesp", 8000, day(nov, 9))}, nil,
			[]Match{{"b1", "t1", nov}}},
		"accented description": {[]Bill{{ID: "b1", Name: "agua", ExpectedCents: 8000}}, []Txn{exp("t1", "PAGTO ÁGUA SABESP", 8000, day(nov, 9))}, nil,
			[]Match{{"b1", "t1", nov}}},
		"longer name wins, the other stays unpaid": {
			[]Bill{{ID: "b1", Name: "Luz", ExpectedCents: 9000}, {ID: "b2", Name: "Luz praia", ExpectedCents: 9000}},
			[]Txn{exp("t1", "ENEL LUZ PRAIA", 9000, day(nov, 8))}, nil, []Match{{"b2", "t1", nov}}},
		"taken longest name leaves the shorter unpaid": {
			[]Bill{{ID: "b1", Name: "Luz", ExpectedCents: 9000}, {ID: "b2", Name: "Luz praia", ExpectedCents: 9000}},
			[]Txn{exp("t1", "ENEL LUZ PRAIA", 9000, day(nov, 8))}, map[billMonth]bool{{"b2", nov}: true}, nil},
		"income never matches":   {[]Bill{rent}, []Txn{{ID: "t1", Description: "ALUGUEL", AmountCents: 150000, PostedOn: day(nov, 5), Type: "income"}}, nil, nil},
		"transfer never matches": {[]Bill{rent}, []Txn{{ID: "t1", Description: "ALUGUEL", AmountCents: -150000, PostedOn: day(nov, 5), Type: "transfer"}}, nil, nil},
		"each month pays its own": {[]Bill{rent}, []Txn{exp("t1", "ALUGUEL", 150000, day(oct, 5)), exp("t2", "ALUGUEL", 150000, day(nov, 5))}, nil,
			[]Match{{"b1", "t1", oct}, {"b1", "t2", nov}}},
		"taken month is skipped":    {[]Bill{rent}, []Txn{exp("t1", "ALUGUEL", 150000, day(nov, 5))}, map[billMonth]bool{{"b1", nov}: true}, nil},
		"earliest transaction wins": {[]Bill{rent}, []Txn{exp("t2", "ALUGUEL", 150000, day(nov, 9)), exp("t1", "ALUGUEL", 150000, day(nov, 5))}, nil, []Match{{"b1", "t1", nov}}},
		"same day, lowest id":       {[]Bill{rent}, []Txn{exp("t2", "ALUGUEL", 150000, day(nov, 5)), exp("t1", "ALUGUEL", 150000, day(nov, 5))}, nil, []Match{{"b1", "t1", nov}}},
		"equal names, lowest bill id": {[]Bill{{ID: "b2", Name: "Gym", ExpectedCents: 100}, {ID: "b1", Name: "Gym", ExpectedCents: 100}},
			[]Txn{exp("t1", "GYM", 100, day(nov, 5))}, nil, []Match{{"b1", "t1", nov}}},
		"short name is ignored": {[]Bill{{ID: "b1", Name: "Gá", ExpectedCents: 100}}, []Txn{exp("t1", "GA GA", 100, day(nov, 5))}, nil, nil},
	} {
		if got := MatchBills(c.bills, c.txns, c.taken); !slices.Equal(got, c.want) {
			t.Errorf("%s: got %v, want %v", name, got, c.want)
		}
	}
}

func dayTxn(year int, month time.Month, day int, amount int64, typ string) Txn {
	return Txn{PostedOn: time.Date(year, month, day, 0, 0, 0, 0, time.UTC), AmountCents: amount, Type: typ}
}

func TestCumulativeDaily(t *testing.T) {
	t.Parallel()
	feb := time.Date(2026, time.February, 1, 0, 0, 0, 0, time.UTC)
	for name, c := range map[string]struct {
		month time.Time
		txns  []Txn
		days  int
		at    map[int]int64 // day of month -> cumulative cents
	}{
		"empty month is all zeros": {time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC), nil, 30, map[int]int64{1: 0, 30: 0}},
		"one expense on day 1":     {feb, []Txn{dayTxn(2026, 2, 1, -500, "expense")}, 28, map[int]int64{1: 500, 28: 500}},
		"two on a day, one later": {feb, []Txn{dayTxn(2026, 2, 2, -100, "expense"), dayTxn(2026, 2, 2, -50, "expense"), dayTxn(2026, 2, 4, -25, "expense")}, 28,
			map[int]int64{1: 0, 2: 150, 3: 150, 4: 175}},
		"a refund lowers the total": {feb, []Txn{dayTxn(2026, 2, 1, -1000, "expense"), dayTxn(2026, 2, 3, 300, "expense")}, 28,
			map[int]int64{2: 1000, 3: 700, 28: 700}},
		"transfers and income are ignored": {feb, []Txn{dayTxn(2026, 2, 1, -900, "transfer"), dayTxn(2026, 2, 2, 5000, "income")}, 28, map[int]int64{28: 0}},
		"29-day February":                  {time.Date(2028, time.February, 1, 0, 0, 0, 0, time.UTC), []Txn{dayTxn(2028, 2, 29, -70, "expense")}, 29, map[int]int64{28: 0, 29: 70}},
		"31-day month end": {time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC), []Txn{dayTxn(2026, 10, 31, -90, "expense")}, 31,
			map[int]int64{30: 0, 31: 90}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			got := CumulativeDaily(c.txns, c.month)
			if len(got) != c.days {
				t.Fatalf("len = %d, want %d", len(got), c.days)
			}
			for day, want := range c.at {
				if got[day-1] != want {
					t.Errorf("day %d = %d, want %d", day, got[day-1], want)
				}
			}
		})
	}
}

func TestUsualPace(t *testing.T) {
	t.Parallel()
	thirty := make([]int64, 30) // day d is 10d, ends at 300
	for i := range thirty {
		thirty[i] = int64(i+1) * 10
	}
	thirtyOne := make([]int64, 31) // day d is 20d, ends at 620
	for i := range thirtyOne {
		thirtyOne[i] = int64(i+1) * 20
	}
	for name, c := range map[string]struct {
		months [][]int64
		days   int
		want   map[int]int64 // day of month -> average
	}{
		"no history is empty": {nil, 31, nil},
		"one month is itself": {[][]int64{thirty}, 30, map[int]int64{1: 10, 30: 300}},
		"a plain day":         {[][]int64{thirty, thirtyOne}, 31, map[int]int64{1: 15, 30: 450}},
		"a short month holds its final total on day 31": {[][]int64{thirty, thirtyOne}, 31, map[int]int64{31: 460}},
		"rounds half up":               {[][]int64{{1}, {2}}, 1, map[int]int64{1: 2}},
		"rounds a negative average up": {[][]int64{{-1}, {-1}, {0}}, 1, map[int]int64{1: -1}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			got := UsualPace(c.months, c.days)
			if c.want == nil {
				if len(got) != 0 {
					t.Fatalf("got %v, want empty", got)
				}
				return
			}
			if len(got) != c.days {
				t.Fatalf("len = %d, want %d", len(got), c.days)
			}
			for day, want := range c.want {
				if got[day-1] != want {
					t.Errorf("day %d = %d, want %d", day, got[day-1], want)
				}
			}
		})
	}
}
