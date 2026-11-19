// Package pantry is the User's private Pantry: generic items at home and
// whether each ran out. State is derived from events, never stored.
package pantry

import (
	"strings"
	"time"
)

// The two states an item can be in. There is no "running low".
const (
	InStock = "in_stock"
	RanOut  = "ran_out"
)

// StateOf is RanOut only when there is a run-out strictly after the latest
// purchase (or no purchase). A run-out on the purchase day is InStock: the
// User usually marks it, then shops.
func StateOf(latestPurchase, latestRunOut *time.Time) string {
	if latestRunOut != nil && (latestPurchase == nil || latestRunOut.After(*latestPurchase)) {
		return RanOut
	}
	return InStock
}

var accents = strings.NewReplacer(
	"Á", "A", "À", "A", "Â", "A", "Ã", "A", "Ä", "A", "É", "E", "È", "E", "Ê", "E", "Ë", "E",
	"Í", "I", "Ì", "I", "Î", "I", "Ï", "I", "Ó", "O", "Ò", "O", "Ô", "O", "Õ", "O", "Ö", "O",
	"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U", "Ç", "C", "Ñ", "N")

// LineKey is the stable form of a receipt line's description: uppercase,
// accents removed, runs of spaces collapsed, digits kept (unlike
// finance.MerchantKey, which drops them: "LEITE 1L" and "LEITE 5L" are
// different products). Matches are saved under it.
// shortcut: the same product described differently at two stores is two keys,
// and the store's product code is not part of the key; upgrade when Users
// report asking twice.
func LineKey(description string) string {
	return strings.Join(strings.Fields(accents.Replace(strings.ToUpper(description))), " ")
}
