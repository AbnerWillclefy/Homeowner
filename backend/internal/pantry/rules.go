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

// ListInput is one item as the list builder reads it: its last purchase (nil
// when never bought) and the User's edit of the list, if any.
type ListInput struct {
	ItemID, Name       string
	PreferredBrand     *string
	Fixed              bool
	State              string
	Unit               string // the last purchase's unit; "" for an item never bought
	LastQuantityMilli  *int64
	LastUnitPriceCents *int64
	EditQuantityMilli  *int64
	Removed            bool
}

const oneUnitMilli = 1000

// BuildList keeps the items that ran out or are fixed, unless an edit removed
// them. Quantity is the edit's, else the last bought, else one unit. The total
// sums quantity times unit price (thousandths, rounded half up once per row)
// over priced rows only.
func BuildList(in []ListInput) (rows []ListRow, totalCents int64) {
	rows = []ListRow{}
	for _, it := range in {
		if it.Removed || (it.State != RanOut && !it.Fixed) {
			continue
		}
		r := ListRow{ItemID: it.ItemID, Name: it.Name, PreferredBrand: it.PreferredBrand, Fixed: it.Fixed, QuantityMilli: oneUnitMilli, Unit: "UN", UnitPriceCents: it.LastUnitPriceCents}
		if it.Unit != "" {
			r.Unit = it.Unit
		}
		switch {
		case it.EditQuantityMilli != nil:
			r.QuantityMilli = *it.EditQuantityMilli
		case it.LastQuantityMilli != nil:
			r.QuantityMilli = *it.LastQuantityMilli
		}
		if r.UnitPriceCents != nil {
			r.PriceCents = new((r.QuantityMilli**r.UnitPriceCents + 500) / 1000)
			totalCents += *r.PriceCents
		}
		rows = append(rows, r)
	}
	return rows, totalCents
}

// AvgDuration is the mean number of days, rounded half up, from a purchase to
// the run-out that ended it: each run-out pairs with the latest purchase
// strictly before it, and one with none is dropped. Absent with no pair.
func AvgDuration(purchases, runOuts []time.Time) *int {
	var sum, n int
	for _, ro := range runOuts {
		var start *time.Time
		for i := range purchases {
			if purchases[i].Before(ro) && (start == nil || purchases[i].After(*start)) {
				start = &purchases[i]
			}
		}
		if start != nil {
			sum += int(ro.Sub(*start).Hours() / 24)
			n++
		}
	}
	if n == 0 {
		return nil
	}
	return new((2*sum + n) / (2 * n))
}
