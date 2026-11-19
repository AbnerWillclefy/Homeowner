// Package pantry is the User's private Pantry: generic items at home and
// whether each ran out. State is derived from events, never stored.
package pantry

import "time"

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
