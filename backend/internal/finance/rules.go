package finance

import (
	"cmp"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Sign convention: amount_cents is signed from the Source's point of view,
// negative is money out and positive is money in. The direction is the sign,
// never Pluggy's type: on a credit card a purchase is negative with type
// CREDIT. The amount spent on an expense is -amount_cents, so a refund is a
// negative spend.

var (
	saoPaulo = mustLoad("America/Sao_Paulo")
	// installmentMark is "PARC 03/10" in a description, which changes per charge.
	installmentMark = regexp.MustCompile(`\bPARC\s*\d+\s*/\s*\d+`)
	// installmentText captures "PARC 03/10" or "PARCELA 3/10": number, then total.
	installmentText = regexp.MustCompile(`(?i)\bPARC(?:ELA)?\s*(\d{1,2})\s*/\s*(\d{1,2})\b`)
	notLetters      = regexp.MustCompile(`[^A-Z]+`)
	accents         = strings.NewReplacer(
		"Á", "A", "À", "A", "Â", "A", "Ã", "A", "Ä", "A",
		"É", "E", "È", "E", "Ê", "E", "Ë", "E",
		"Í", "I", "Ì", "I", "Î", "I", "Ï", "I",
		"Ó", "O", "Ò", "O", "Ô", "O", "Õ", "O", "Ö", "O",
		"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U",
		"Ç", "C", "Ñ", "N")
)

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// MerchantKey is the stable form of a description: uppercase, accents folded,
// "PARC nn/mm", digits and punctuation removed, spaces collapsed. The same
// merchant gives the same key across charges.
func MerchantKey(description string) string {
	s := accents.Replace(strings.ToUpper(description))
	// shortcut: letters outside A-Z (other alphabets) are dropped, when Finances leave pt-BR.
	return strings.TrimSpace(notLetters.ReplaceAllString(installmentMark.ReplaceAllString(s, " "), " "))
}

// pluggyCategories maps the categories Pluggy sends (seen in the sandbox
// capture) to a Spending Category id. A category not here, or none, goes on to
// the Categorizer. shortcut: only the capture's categories, add more as real
// Items show them.
var pluggyCategories = map[string]string{
	"Housing":                  "housing",
	"Electricity":              "household_bills",
	"Internet":                 "household_bills",
	"Mobile":                   "household_bills",
	"Telecommunications":       "household_bills",
	"Music streaming":          "subscriptions",
	"Video streaming":          "subscriptions",
	"Gyms and fitness centers": "health",
}

// postedOn is the São Paulo calendar day of a Pluggy timestamp, as a UTC
// midnight so it stores and compares as a plain date. The User has no zone.
func postedOn(at time.Time) time.Time {
	y, m, d := at.In(saoPaulo).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// Kind is a Source's kind as stored: checking, savings or credit_card.
type Kind string

// transferWindowDays is "a few days": how far apart the two halves of a Transfer
// may post.
const transferWindowDays = 3

// billPayments are merchant keys that mark a card bill payment, on either side.
var billPayments = []string{"PAGAMENTO FATURA", "PAGAMENTO RECEBIDO"}

// Txn is the part of a Transaction the rules read and decide.
type Txn struct {
	ID, SourceID, Currency, MerchantKey string
	// Description is the raw text, read only by MatchBills.
	Description     string
	PostedOn        time.Time
	AmountCents     int64
	Type, TypeSetBy string
	// Category is the spending category, empty unless Type is expense.
	Category, CategorySetBy string
}

// Classify sets the type of every auto Txn and returns those whose type or
// category changed. A row the User set is neither changed nor used as a partner.
//
// Rules, in order: a bill payment is a Transfer; a debit and a credit of the
// same amount and currency on two Sources within transferWindowDays are both
// Transfers; any other credit on a credit_card Source is an Expense, a refund
// (a negative spend); any other credit is Income, any other debit an Expense.
//
// Accepted: a Transfer has no category, so a row the User only categorised
// loses that category when it pairs. An unrelated debit and credit that coincide are paired. The User
// can correct it, and their choice is never overwritten. A row that drops out
// of a pair after a re-fetch goes back to its single-row rule, so callers pass
// the whole window, not only the new rows.
func Classify(txns []Txn, kinds map[string]Kind) []Txn {
	var auto []Txn
	for _, t := range txns {
		if t.TypeSetBy == "auto" {
			auto = append(auto, t)
		}
	}
	transfer := map[string]bool{}
	for _, t := range auto {
		for _, p := range billPayments {
			if strings.Contains(t.MerchantKey, p) {
				transfer[t.ID] = true
			}
		}
	}
	type pair struct {
		debit, credit Txn
		gap           int
	}
	var pairs []pair
	for _, d := range auto {
		for _, c := range auto {
			if d.AmountCents >= 0 || c.AmountCents != -d.AmountCents || d.SourceID == c.SourceID || d.Currency != c.Currency {
				continue
			}
			if gap := int(math.Abs(c.PostedOn.Sub(d.PostedOn).Hours() / 24)); gap <= transferWindowDays {
				pairs = append(pairs, pair{d, c, gap})
			}
		}
	}
	slices.SortFunc(pairs, func(a, b pair) int {
		return cmp.Or(cmp.Compare(a.gap, b.gap), cmp.Compare(a.debit.ID, b.debit.ID), cmp.Compare(a.credit.ID, b.credit.ID))
	})
	paired := map[string]bool{}
	for _, p := range pairs {
		if !paired[p.debit.ID] && !paired[p.credit.ID] {
			paired[p.debit.ID], paired[p.credit.ID] = true, true
			transfer[p.debit.ID], transfer[p.credit.ID] = true, true
		}
	}

	var changed []Txn
	for _, t := range auto {
		n := t
		switch {
		case transfer[t.ID]:
			n.Type = "transfer"
		case t.AmountCents < 0, kinds[t.SourceID] == "credit_card":
			n.Type = "expense"
		default:
			n.Type = "income"
		}
		switch {
		case n.Type != "expense":
			n.Category, n.CategorySetBy = "", ""
		case n.Category == "":
			n.Category, n.CategorySetBy = "other", "fallback"
		}
		if n != t {
			changed = append(changed, n)
		}
	}
	return changed
}

// ParseInstallment is the installment a charge belongs to: Pluggy's own numbers
// (metaN of metaM, 0 when absent) first, else a "PARC 03/10" in the description.
// Only 1 <= n <= m with m >= 2 is accepted, so "PARC 10/10" is the last one and
// "PARC 00/10", "PARC 11/10", "PARC 3/" and a bare date "10/11" are refused.
func ParseInstallment(description string, metaN, metaM int) (n, m int, ok bool) {
	if validInstallment(metaN, metaM) {
		return metaN, metaM, true
	}
	g := installmentText.FindStringSubmatch(description)
	if g == nil {
		return 0, 0, false
	}
	n, _ = strconv.Atoi(g[1])
	m, _ = strconv.Atoi(g[2])
	if !validInstallment(n, m) {
		return 0, 0, false
	}
	return n, m, true
}

func validInstallment(n, m int) bool { return m >= 2 && n >= 1 && n <= m }

// Plan is the latest seen charge of an Installment plan.
type Plan struct {
	Name          string
	Number, Total int
	AmountCents   int64 // what one installment costs, positive
	// Month is the month (first day, UTC) of the charge numbered Number.
	Month time.Time
}

// PlanName is the description without its installment token, or the merchant
// key when nothing else is left.
func PlanName(description, merchantKey string) string {
	if name := strings.Join(strings.Fields(installmentText.ReplaceAllString(description, " ")), " "); name != "" {
		return name
	}
	return merchantKey
}

// InstallmentLine is one plan's installment due in a month.
type InstallmentLine struct {
	Name        string `json:"name"`
	Number      int    `json:"number"`
	Total       int    `json:"total"`
	AmountCents int64  `json:"amountCents"`
}

// ProjectInstallments lists, for each of the months months from from (a first
// of month), the installments the plans still owe: number n+1 falls one month
// after the latest seen charge, and so on to the last. A finished plan owes
// nothing. shortcut: the current amount is repeated, a plan whose price changes is wrong.
func ProjectInstallments(plans []Plan, from time.Time, months int) [][]InstallmentLine {
	out := make([][]InstallmentLine, months)
	for _, p := range plans {
		for k := p.Number + 1; k <= p.Total; k++ {
			i := monthIndex(p.Month.AddDate(0, k-p.Number, 0)) - monthIndex(from)
			if i >= 0 && i < months {
				out[i] = append(out[i], InstallmentLine{p.Name, k, p.Total, p.AmountCents})
			}
		}
	}
	return out
}

func monthIndex(t time.Time) int { return t.Year()*12 + int(t.Month()) }

// DueDate is the day a Bill with dueDay falls due in the month, as a UTC
// midnight: a day past the month end falls on its last day.
func DueDate(year int, month time.Month, dueDay int) time.Time {
	last := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC)
	return time.Date(year, month, min(dueDay, last.Day()), 0, 0, 0, 0, time.UTC)
}

// Totals is the spend of a set of Transactions, in centavos.
type Totals struct {
	Spend      int64
	ByCategory map[string]int64
}

// MonthTotals sums the Expenses by Spending Category. Transfers and Income are
// ignored; a refund (a negative spend) offsets its category. A category can end
// negative in a refund-heavy month: it is returned as is, not clamped.
func MonthTotals(txns []Txn) Totals {
	out := Totals{ByCategory: map[string]int64{}}
	for _, t := range txns {
		if t.Type == "expense" {
			out.Spend -= t.AmountCents
			out.ByCategory[t.Category] -= t.AmountCents
		}
	}
	return out
}

// Bill is the part of a Bill the matcher reads.
type Bill struct {
	ID, Name      string
	ExpectedCents int64
}

// billMonth is one Bill in one month (the first day, UTC): the key of a payment.
type billMonth struct {
	BillID string
	Month  time.Time
}

// Match says a Transaction pays a Bill for the month of its posted_on.
type Match struct {
	BillID, TxnID string
	Month         time.Time
}

// minBillName keeps a short name such as "Gas" from matching everything.
const minBillName = 3

// fold is uppercase with accents folded and spaces collapsed.
func fold(s string) string {
	return strings.Join(strings.Fields(accents.Replace(strings.ToUpper(s))), " ")
}

// MatchBills pairs Expenses with the Bills they pay. A Bill matches a
// Transaction posted in the Bill's month when its folded name is contained in
// the folded description and -amount equals the expected amount exactly. A
// Transaction pays one Bill: the longest name, then the lowest id. A Bill-month
// takes one Transaction: the earliest, then the lowest id. A Bill-month in
// taken (paid by hand, by the bank, or undone) is skipped. Matches come ordered
// by month, then Bill id.
//
// shortcut: a Bill paid early, in the month before its Transaction posts, does
// not match; when that hurts, widen the month by the Bill's due day.
func MatchBills(bills []Bill, txns []Txn, taken map[billMonth]bool) []Match {
	txns = slices.Clone(txns)
	slices.SortFunc(txns, func(a, b Txn) int { return cmp.Or(a.PostedOn.Compare(b.PostedOn), cmp.Compare(a.ID, b.ID)) })
	names := make([]string, len(bills))
	for i, b := range bills {
		names[i] = fold(b.Name)
	}
	won := map[billMonth]Match{}
	for _, t := range txns {
		if t.Type != "expense" {
			continue
		}
		desc := fold(t.Description)
		month := time.Date(t.PostedOn.Year(), t.PostedOn.Month(), 1, 0, 0, 0, 0, time.UTC)
		best := -1
		for i, b := range bills {
			if len(names[i]) < minBillName || b.ExpectedCents != -t.AmountCents || !strings.Contains(desc, names[i]) || taken[billMonth{b.ID, month}] {
				continue
			}
			if best < 0 || cmp.Or(cmp.Compare(len(names[i]), len(names[best])), cmp.Compare(bills[best].ID, b.ID)) > 0 {
				best = i
			}
		}
		if best < 0 {
			continue
		}
		k := billMonth{bills[best].ID, month}
		if _, done := won[k]; !done {
			won[k] = Match{k.BillID, t.ID, month}
		}
	}
	var out []Match
	for _, m := range won {
		out = append(out, m)
	}
	slices.SortFunc(out, func(a, b Match) int { return cmp.Or(a.Month.Compare(b.Month), cmp.Compare(a.BillID, b.BillID)) })
	return out
}
