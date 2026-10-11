// Package vocab holds the fixed lists of Categories and Demands (see
// CONTEXT.md). Ids are snake_case strings stored in the database and sent on
// the wire, so renaming one needs a data migration. The allocation package
// never imports this one; its Demand values equal these ids.
package vocab

import "slices"

var (
	categories = []string{
		"kitchen", "bathroom", "bedroom", "living_room", "laundry",
		"floors", "trash", "outdoor", "pets", "other",
	}
	demands = []string{"heavy_lifting", "bending", "heights", "strong_chemicals"}
)

// Categories returns the Category ids in display order.
func Categories() []string { return slices.Clone(categories) }

// Demands returns the Demand ids in display order.
func Demands() []string { return slices.Clone(demands) }

// IsCategory reports whether id is a Category.
func IsCategory(id string) bool { return slices.Contains(categories, id) }

// IsDemand reports whether id is a Demand.
func IsDemand(id string) bool { return slices.Contains(demands, id) }
