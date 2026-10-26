// Package catalog is the fixed Catalog of common Chores and the rules that
// turn answers about a Home into proposed Chores (see GLOSSARY.md). The rules
// are pure: no database, HTTP or clock; handler.go is the HTTP edge. Nothing
// here is stored; a Chore made from an Entry is an ordinary Chore.
package catalog

import (
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// Entry is one Catalog Chore. Fields.Name is the English fallback name; the
// client localises through ID. PerRoom entries repeat once per room. The
// entry also carries its rule: count is how many Chores the answers call for,
// and adjust, if set, changes the Chore's Effort, interval or weekdays.
type Entry struct {
	ID string
	chores.Fields
	PerRoom bool

	count  func(clean) int
	adjust func(*chores.Fields, clean)
}

func ptr(n int) *int { return &n }

// entry builds an Entry with normalised, never-nil slices. Its rule starts as
// "never proposed"; counts and adjusts set it.
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
		count:   func(clean) int { return 0 },
	}
}

func (e Entry) counts(f func(clean) int) Entry { e.count = f; return e }

func (e Entry) adjusts(f func(*chores.Fields, clean)) Entry { e.adjust = f; return e }

// when is a count of one if cond holds and none otherwise.
func when(cond func(clean) bool) func(clean) int {
	return func(c clean) int {
		if cond(c) {
			return 1
		}
		return 0
	}
}

func hasPet(kind string) func(clean) bool {
	return func(c clean) bool { return slices.Contains(c.pets, kind) }
}

func hasKitchen(c clean) bool { return c.kitchens > 0 }

func hasRooms(c clean) bool {
	return c.bedrooms+c.bathrooms+c.kitchens+c.livingRooms+c.laundryAreas > 0
}

var (
	none      = []string{}
	chemicals = []string{"bending", "strong_chemicals"}
	bending   = []string{"bending"}
)

// table is the Catalog in display order, built once. Entries returns copies.
var table = []Entry{
	entry("clean_kitchen", "Clean the kitchen", "kitchen", bending, 2, "normal", 7, true, true).
		counts(func(c clean) int { return c.kitchens }).
		adjusts(func(f *chores.Fields, c clean) {
			switch c.cooking {
			case "daily":
				f.BaseEffort, f.IntervalDays = 3, ptr(3)
			case "rarely":
				f.IntervalDays = ptr(14)
			}
		}),
	entry("wash_dishes", "Wash the dishes", "kitchen", none, 1, "essential", 1, true, false).
		counts(when(func(c clean) bool { return hasKitchen(c) && !c.dishwasher })),
	entry("load_dishwasher", "Load and unload the dishwasher", "kitchen", none, 1, "essential", 1, true, false).
		counts(when(func(c clean) bool { return hasKitchen(c) && c.dishwasher })),
	entry("clean_fridge", "Clean the fridge", "kitchen", bending, 2, "normal", 30, false, false).
		counts(when(hasKitchen)),
	entry("clean_oven", "Clean the oven", "kitchen", chemicals, 3, "nice_to_have", 90, false, false).
		counts(when(func(c clean) bool { return hasKitchen(c) && c.cooking != "rarely" })).
		adjusts(func(f *chores.Fields, c clean) {
			if c.cooking == "daily" {
				f.IntervalDays = ptr(60)
			}
		}),
	entry("clean_bathroom", "Clean the bathroom", "bathroom", chemicals, 3, "essential", 7, true, true).
		counts(func(c clean) int { return c.bathrooms }),
	entry("change_bed_linen", "Change the bed linen", "bedroom", bending, 2, "normal", 14, false, true).
		counts(func(c clean) int { return c.bedrooms }),
	entry("tidy_living_room", "Tidy the living room", "living_room", none, 2, "normal", 7, true, true).
		counts(func(c clean) int { return c.livingRooms }),
	entry("clean_laundry_area", "Clean the laundry area", "laundry", bending, 1, "nice_to_have", 30, false, true).
		counts(func(c clean) int { return c.laundryAreas }),
	entry("wash_laundry", "Wash the laundry", "laundry", none, 2, "normal", 7, true, false).
		counts(when(func(c clean) bool { return c.washingMachine })),
	entry("fold_laundry", "Fold and put away the laundry", "laundry", none, 2, "normal", 7, true, false).
		counts(when(func(c clean) bool { return c.washingMachine })),
	entry("vacuum_floors", "Vacuum the floors", "floors", bending, 3, "normal", 7, true, false).
		counts(when(hasRooms)),
	entry("mop_floors", "Mop the floors", "floors", bending, 3, "normal", 14, true, false).
		counts(when(hasRooms)),
	entry("put_out_trash", "Put out the trash", "trash", none, 1, "essential", 7, false, false).
		counts(when(func(c clean) bool { return len(c.trashDays) > 0 })).
		adjusts(func(f *chores.Fields, c clean) { f.AllowedWeekdays = slices.Clone(c.trashDays) }),
	entry("put_out_recycling", "Put out the recycling", "trash", none, 1, "essential", 7, false, false).
		counts(when(func(c clean) bool { return len(c.recyclingDays) > 0 })).
		adjusts(func(f *chores.Fields, c clean) { f.AllowedWeekdays = slices.Clone(c.recyclingDays) }),
	entry("sweep_balcony", "Sweep the balcony", "outdoor", bending, 1, "nice_to_have", 14, true, true).
		counts(func(c clean) int { return c.balconies }),
	entry("mow_lawn", "Mow the lawn", "outdoor", []string{"heavy_lifting"}, 4, "normal", 14, true, true).
		counts(func(c clean) int { return c.yards }),
	entry("sweep_yard", "Sweep the yard", "outdoor", bending, 2, "nice_to_have", 14, true, true).
		counts(func(c clean) int { return c.yards + c.gardens }),
	entry("weed_garden", "Weed the garden", "outdoor", bending, 3, "normal", 14, true, true).
		counts(func(c clean) int { return c.gardens }),
	entry("water_garden", "Water the garden", "outdoor", none, 1, "normal", 2, false, true).
		counts(func(c clean) int { return c.gardens }),
	entry("walk_dog", "Walk the dog", "pets", none, 2, "essential", 1, false, false).
		counts(when(hasPet("dog"))),
	entry("feed_dog", "Feed the dog", "pets", none, 1, "essential", 1, false, false).
		counts(when(hasPet("dog"))),
	entry("bathe_dog", "Bathe the dog", "pets", []string{"bending", "heavy_lifting"}, 3, "nice_to_have", 30, false, false).
		counts(when(hasPet("dog"))),
	entry("clean_litter_box", "Clean the litter box", "pets", bending, 2, "essential", 1, true, false).
		counts(when(hasPet("cat"))),
	entry("feed_cat", "Feed the cat", "pets", none, 1, "essential", 1, false, false).
		counts(when(hasPet("cat"))),
	entry("feed_fish", "Feed the fish", "pets", none, 1, "essential", 1, false, false).
		counts(when(hasPet("fish"))),
	entry("clean_fish_tank", "Clean the fish tank", "pets", bending, 3, "normal", 14, true, false).
		counts(when(hasPet("fish"))),
	entry("feed_bird", "Feed the bird", "pets", none, 1, "essential", 1, false, false).
		counts(when(hasPet("bird"))),
	entry("clean_bird_cage", "Clean the bird cage", "pets", bending, 2, "normal", 7, true, false).
		counts(when(hasPet("bird"))),
	entry("care_for_pet", "Care for the pet", "pets", none, 1, "normal", 1, false, false).
		counts(when(hasPet("other"))),
}

// cloneFields copies the slices and pointer in f, so a caller can change the
// result without touching the Catalog.
func cloneFields(f chores.Fields) chores.Fields {
	f.Demands = slices.Clone(f.Demands)
	f.AllowedWeekdays = slices.Clone(f.AllowedWeekdays)
	if f.IntervalDays != nil {
		f.IntervalDays = ptr(*f.IntervalDays)
	}
	return f
}

// Entries returns the Catalog in display order. The caller owns the result.
func Entries() []Entry {
	out := make([]Entry, len(table))
	for i, e := range table {
		e.Fields = cloneFields(e.Fields)
		out[i] = e
	}
	return out
}
