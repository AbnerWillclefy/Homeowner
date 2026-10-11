// Package catalog is the fixed Catalog of common Chores and the rules that
// turn answers about a Home into proposed Chores (see CONTEXT.md). It is
// pure: no database, HTTP or clock. Nothing here is stored; a Chore made from
// an Entry is an ordinary Chore.
package catalog

import (
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// Entry is one Catalog Chore. Fields.Name is the English fallback name; the
// client localises through ID. PerRoom entries repeat once per room.
type Entry struct {
	ID string
	chores.Fields
	PerRoom bool
}

func ptr(n int) *int { return &n }

// entry builds an Entry with normalised, never-nil slices.
func entry(id, name, category string, demands []string, effort int, importance string,
	interval int, buildsUp, perRoom bool) Entry {
	return Entry{
		ID: id,
		Fields: chores.Fields{
			Name: name, Category: category, Demands: slices.Clone(demands), BaseEffort: effort,
			Importance: importance, People: 1, IntervalDays: ptr(interval),
			AllowedWeekdays: []int{}, BuildsUp: buildsUp,
		},
		PerRoom: perRoom,
	}
}

var (
	none      = []string{}
	chemicals = []string{"bending", "strong_chemicals"}
	bending   = []string{"bending"}
)

// entries is the Catalog in display order. Dependent rules in Propose refer to
// ids here; the consistency test guards that each exists and is valid.
func entries() []Entry {
	return []Entry{
		entry("clean_kitchen", "Clean the kitchen", "kitchen", bending, 2, "normal", 7, true, true),
		entry("wash_dishes", "Wash the dishes", "kitchen", none, 1, "essential", 1, true, false),
		entry("load_dishwasher", "Load and unload the dishwasher", "kitchen", none, 1, "essential", 1, true, false),
		entry("clean_fridge", "Clean the fridge", "kitchen", bending, 2, "normal", 30, false, false),
		entry("clean_oven", "Clean the oven", "kitchen", chemicals, 3, "nice_to_have", 90, false, false),
		entry("clean_bathroom", "Clean the bathroom", "bathroom", chemicals, 3, "essential", 7, true, true),
		entry("change_bed_linen", "Change the bed linen", "bedroom", bending, 2, "normal", 14, false, true),
		entry("tidy_living_room", "Tidy the living room", "living_room", none, 2, "normal", 7, true, true),
		entry("clean_laundry_area", "Clean the laundry area", "laundry", bending, 1, "nice_to_have", 30, false, true),
		entry("wash_laundry", "Wash the laundry", "laundry", none, 2, "normal", 7, true, false),
		entry("fold_laundry", "Fold and put away the laundry", "laundry", none, 2, "normal", 7, true, false),
		entry("vacuum_floors", "Vacuum the floors", "floors", bending, 3, "normal", 7, true, false),
		entry("mop_floors", "Mop the floors", "floors", bending, 3, "normal", 14, true, false),
		entry("put_out_trash", "Put out the trash", "trash", none, 1, "essential", 7, false, false),
		entry("put_out_recycling", "Put out the recycling", "trash", none, 1, "essential", 7, false, false),
		entry("sweep_balcony", "Sweep the balcony", "outdoor", bending, 1, "nice_to_have", 14, true, false),
		entry("mow_lawn", "Mow the lawn", "outdoor", []string{"heavy_lifting"}, 4, "normal", 14, true, false),
		entry("sweep_yard", "Sweep the yard", "outdoor", bending, 2, "nice_to_have", 14, true, false),
		entry("weed_garden", "Weed the garden", "outdoor", bending, 3, "normal", 14, true, false),
		entry("water_garden", "Water the garden", "outdoor", none, 1, "normal", 2, false, false),
		entry("walk_dog", "Walk the dog", "pets", none, 2, "essential", 1, false, false),
		entry("feed_dog", "Feed the dog", "pets", none, 1, "essential", 1, false, false),
		entry("bathe_dog", "Bathe the dog", "pets", []string{"bending", "heavy_lifting"}, 3, "nice_to_have", 30, false, false),
		entry("clean_litter_box", "Clean the litter box", "pets", bending, 2, "essential", 1, true, false),
		entry("feed_cat", "Feed the cat", "pets", none, 1, "essential", 1, false, false),
		entry("feed_fish", "Feed the fish", "pets", none, 1, "essential", 1, false, false),
		entry("clean_fish_tank", "Clean the fish tank", "pets", bending, 3, "normal", 14, true, false),
		entry("feed_bird", "Feed the bird", "pets", none, 1, "essential", 1, false, false),
		entry("clean_bird_cage", "Clean the bird cage", "pets", bending, 2, "normal", 7, true, false),
		entry("care_for_pet", "Care for the pet", "pets", none, 1, "normal", 1, false, false),
	}
}

// Entries returns the Catalog in display order. The caller owns the result.
func Entries() []Entry { return entries() }

// find returns the Entry with the id; the consistency test proves every id
// the rules use exists.
func find(id string) Entry {
	for _, e := range entries() {
		if e.ID == id {
			return e
		}
	}
	panic("catalog: unknown entry " + id)
}
