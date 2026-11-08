package finance

import (
	"regexp"
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
