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
