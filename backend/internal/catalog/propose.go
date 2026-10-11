package catalog

import (
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// Proposal is a Chore the answers call for. Instance is 1-based when the
// answers produce several of the same Catalog entry (two bathrooms), and nil
// when they produce one.
type Proposal struct {
	CatalogID string `json:"catalogId"`
	Instance  *int   `json:"instance"`
	chores.Fields
}

// Propose turns answers into proposed Chores, in Catalog display order. It is
// deterministic. Invalid answers (see ValidateAnswers) propose nothing.
func Propose(a Answers) []Proposal {
	c, errs := normalise(a)
	if errs != nil {
		return []Proposal{}
	}
	out := []Proposal{}
	for _, e := range entries() {
		n := countFor(e.ID, c)
		for i := 1; i <= n; i++ {
			p := Proposal{CatalogID: e.ID, Fields: adjust(e, c)}
			if e.PerRoom && n > 1 {
				p.Instance = ptr(i)
			}
			out = append(out, p)
		}
	}
	return out
}

func rooms(c clean) int {
	return c.bedrooms + c.bathrooms + c.kitchens + c.livingRooms + c.laundryAreas
}

func flag(b bool) int {
	if b {
		return 1
	}
	return 0
}

// countFor is how many Chores of the entry the answers call for.
func countFor(id string, c clean) int {
	switch id {
	case "clean_kitchen":
		return c.kitchens
	case "wash_dishes":
		return flag(c.kitchens > 0 && !c.dishwasher)
	case "load_dishwasher":
		return flag(c.kitchens > 0 && c.dishwasher)
	case "clean_fridge":
		return flag(c.kitchens > 0)
	case "clean_oven":
		return flag(c.kitchens > 0 && c.cooking != "rarely")
	case "clean_bathroom":
		return c.bathrooms
	case "change_bed_linen":
		return c.bedrooms
	case "tidy_living_room":
		return c.livingRooms
	case "clean_laundry_area":
		return c.laundryAreas
	case "wash_laundry", "fold_laundry":
		return flag(c.washingMachine)
	case "vacuum_floors", "mop_floors":
		return flag(rooms(c) > 0)
	case "put_out_trash":
		return flag(len(c.trashDays) > 0)
	case "put_out_recycling":
		return flag(len(c.recyclingDays) > 0)
	case "sweep_balcony":
		return flag(c.outdoor == "balcony")
	case "mow_lawn":
		return flag(c.outdoor == "yard")
	case "sweep_yard":
		return flag(c.outdoor == "yard" || c.outdoor == "garden")
	case "weed_garden", "water_garden":
		return flag(c.outdoor == "garden")
	case "walk_dog", "feed_dog", "bathe_dog":
		return flag(slices.Contains(c.pets, "dog"))
	case "clean_litter_box", "feed_cat":
		return flag(slices.Contains(c.pets, "cat"))
	case "feed_fish", "clean_fish_tank":
		return flag(slices.Contains(c.pets, "fish"))
	case "feed_bird", "clean_bird_cage":
		return flag(slices.Contains(c.pets, "bird"))
	case "care_for_pet":
		return flag(slices.Contains(c.pets, "other"))
	}
	return 0
}

// adjust applies the habits and answers that change a Chore's Effort,
// interval or weekdays, not only whether it exists.
func adjust(e Entry, c clean) chores.Fields {
	f := e.Fields
	switch e.ID {
	case "clean_kitchen":
		switch c.cooking {
		case "daily":
			f.BaseEffort, f.IntervalDays = 3, ptr(3)
		case "rarely":
			f.IntervalDays = ptr(14)
		}
	case "clean_oven":
		if c.cooking == "daily" {
			f.IntervalDays = ptr(60)
		}
	case "put_out_trash":
		f.AllowedWeekdays = slices.Clone(c.trashDays)
	case "put_out_recycling":
		f.AllowedWeekdays = slices.Clone(c.recyclingDays)
	}
	return f
}
