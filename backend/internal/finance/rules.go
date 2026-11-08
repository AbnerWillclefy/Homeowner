package finance

import (
	"cmp"
	"math"
	"regexp"
	"slices"
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
	PostedOn                            time.Time
	AmountCents                         int64
	Type, TypeSetBy                     string
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
// Accepted: an unrelated debit and credit that coincide are paired. The User
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
