package finance

import (
	"testing"
	"time"
)

var day0 = time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)

func tx(id, src string, daysAfter int, cents int64) Txn {
	return Txn{ID: id, SourceID: src, Currency: "BRL", MerchantKey: "X", PostedOn: day0.AddDate(0, 0, daysAfter),
		AmountCents: cents, TypeSetBy: "auto"}
}

func TestClassify(t *testing.T) {
	t.Parallel()
	kinds := map[string]Kind{"chk": "checking", "sav": "savings", "card": "credit_card"}
	bill := tx("bill", "chk", 0, -10000)
	bill.MerchantKey = MerchantKey("Pagamento Fatura Cartão")
	userSet := tx("u", "sav", 0, 10000)
	userSet.TypeSetBy = "user"
	usd := tx("c", "sav", 0, 10000)
	usd.Currency = "USD"
	santander := tx("sbill", "card", 0, 50000)
	santander.MerchantKey = MerchantKey("Pagamento de Fatura")
	categorised := tx("cat", "chk", 0, -500)
	categorised.Type, categorised.Category, categorised.CategorySetBy = "expense", "groceries", "auto"

	for name, tc := range map[string]struct {
		in   []Txn
		want map[string]string // id -> type of every row that changes
	}{
		"bill payment, accents and case":  {[]Txn{bill}, map[string]string{"bill": "transfer"}},
		"bill payment, Santander wording": {[]Txn{santander}, map[string]string{"sbill": "transfer"}},
		"exact pair across Sources":       {[]Txn{tx("d", "chk", 0, -10000), tx("c", "sav", 1, 10000)}, map[string]string{"d": "transfer", "c": "transfer"}},
		"same amount on the same Source":  {[]Txn{tx("d", "chk", 0, -10000), tx("c", "chk", 0, 10000)}, map[string]string{"d": "expense", "c": "income"}},
		"another currency":                {[]Txn{tx("d", "chk", 0, -10000), usd}, map[string]string{"d": "expense", "c": "income"}},
		"3 days apart pairs":              {[]Txn{tx("d", "chk", 0, -10000), tx("c", "sav", 3, 10000)}, map[string]string{"d": "transfer", "c": "transfer"}},
		"4 days apart does not":           {[]Txn{tx("d", "chk", 0, -10000), tx("c", "sav", 4, 10000)}, map[string]string{"d": "expense", "c": "income"}},
		"closest candidate wins": {
			[]Txn{tx("d", "chk", 0, -10000), tx("far", "sav", 3, 10000), tx("near", "sav", 1, 10000)},
			map[string]string{"d": "transfer", "near": "transfer", "far": "income"}},
		"user-set row is no partner": {[]Txn{tx("d", "chk", 0, -10000), userSet}, map[string]string{"d": "expense"}},
		"card credit is a refund":    {[]Txn{tx("r", "card", 0, 2500)}, map[string]string{"r": "expense"}},
		"checking credit is income":  {[]Txn{tx("i", "chk", 0, 2500)}, map[string]string{"i": "income"}},
		"category is kept":           {[]Txn{categorised}, map[string]string{}},
	} {
		got := map[string]string{}
		for _, c := range Classify(tc.in, kinds, nil) {
			got[c.ID] = c.Type
			if (c.Type == "expense") != (c.Category != "") {
				t.Errorf("%s: %s is %s with category %q", name, c.ID, c.Type, c.Category)
			}
		}
		if len(got) != len(tc.want) {
			t.Errorf("%s: changed %v, want %v", name, got, tc.want)
			continue
		}
		for id, typ := range tc.want {
			if got[id] != typ {
				t.Errorf("%s: %s = %q, want %q", name, id, got[id], typ)
			}
		}
	}
}

// A debit that equals a stored closed bill's total near its due date is a card
// payment, whatever the bank calls it.
func TestClassifyTakesTheAmountOfAStoredBill(t *testing.T) {
	t.Parallel()
	kinds := map[string]Kind{"chk": "checking", "card": "credit_card"}
	bills := []StoredBill{{ClosesOn: day0.AddDate(0, 0, -7), DueOn: day0, TotalCents: 253090}}
	userSet := tx("p", "chk", 0, -253090)
	userSet.TypeSetBy = "user"
	for name, tc := range map[string]struct {
		in   Txn
		want string // "" when the row stays as it is
	}{
		"on the due date":           {tx("p", "chk", 0, -253090), "transfer"},
		"3 days after, inside":      {tx("p", "chk", 3, -253090), "transfer"},
		"3 days before, inside":     {tx("p", "chk", -3, -253090), "transfer"},
		"4 days after, outside":     {tx("p", "chk", 4, -253090), "expense"},
		"4 days before, outside":    {tx("p", "chk", -4, -253090), "expense"},
		"one centavo off":           {tx("p", "chk", 0, -253091), "expense"},
		"on a card Source":          {tx("p", "card", 0, -253090), "expense"},
		"a credit of that amount":   {tx("p", "chk", 0, 253090), "income"},
		"a row the User classified": {userSet, ""},
		"in another currency":       {Txn{ID: "p", SourceID: "chk", Currency: "USD", MerchantKey: "X", PostedOn: day0, AmountCents: -253090, TypeSetBy: "auto"}, "expense"},
	} {
		got := ""
		for _, c := range Classify([]Txn{tc.in}, kinds, bills) {
			got = c.Type
		}
		if got != tc.want {
			t.Errorf("%s: type = %q, want %q", name, got, tc.want)
		}
	}
	// A credit-balance bill must not turn a matching credit into a Transfer.
	credit := []StoredBill{{ClosesOn: day0.AddDate(0, 0, -7), DueOn: day0, TotalCents: -253090}}
	for _, c := range Classify([]Txn{tx("p", "chk", 0, 253090)}, kinds, credit) {
		if c.Type != "income" {
			t.Errorf("credit vs negative bill: type = %q, want income", c.Type)
		}
	}
}

func TestMonthTotals(t *testing.T) {
	t.Parallel()
	exp := func(cat string, cents int64) Txn { return Txn{Type: "expense", Category: cat, AmountCents: cents} }
	for name, tc := range map[string]struct {
		in    []Txn
		spend int64
		food  int64
	}{
		"refund offsets its category":  {[]Txn{exp("groceries", -10000), exp("groceries", 2500)}, 7500, 7500},
		"transfer and income ignored":  {[]Txn{exp("groceries", -1000), {Type: "transfer", AmountCents: -9000}, {Type: "income", AmountCents: 9000}}, 1000, 1000},
		"refund beyond purchases goes": {[]Txn{exp("groceries", -1000), exp("groceries", 4000)}, -3000, -3000},
	} {
		got := MonthTotals(tc.in)
		if got.Spend != tc.spend || got.ByCategory["groceries"] != tc.food {
			t.Errorf("%s: %+v, want spend %d groceries %d", name, got, tc.spend, tc.food)
		}
	}
}
