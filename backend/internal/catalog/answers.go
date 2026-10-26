package catalog

import (
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// Bounds on the answers. Room counts are 0 to MaxRooms, kitchens 0 to
// MaxKitchens, each outdoor area type 0 to MaxOutdoor.
const (
	MaxRooms    = 10
	MaxKitchens = 3
	MaxOutdoor  = 10
	// MaxProposals bounds what Propose can return; a test proves the largest
	// possible answers stay within it (see
	// TestAHomeKeepingEveryProposalForTheLargestAnswersIsCreated).
	MaxProposals = 125
)

// Answer vocabularies. They are never stored, so they live here, not in vocab.
var (
	pets     = []string{"dog", "cat", "fish", "bird", "other"}
	cookings = []string{"rarely", "sometimes", "daily"}
)

// Pets returns the pet answers.
func Pets() []string { return slices.Clone(pets) }

// Cookings returns the cooking-at-home answers.
func Cookings() []string { return slices.Clone(cookings) }

// Answers is the questionnaire, decoded straight from the request body. Every
// part is optional and a missing one means none (cooking: "sometimes"). Room
// counts and weekdays are `any` (a JSON number arrives as float64) so a
// string or 2.5 is a field error with a code rather than a bad request.
type Answers struct {
	Rooms      *RoomAnswers       `json:"rooms"`
	Outdoor    *OutdoorAnswers    `json:"outdoor"`
	Pets       []string           `json:"pets"`
	Collection *CollectionAnswers `json:"collection"`
	Habits     *HabitAnswers      `json:"habits"`
}

// OutdoorAnswers are the outdoor area counts by type. They are kept apart from
// RoomAnswers so an outdoor area never counts as a room for the floor Chores.
type OutdoorAnswers struct {
	Balconies any `json:"balconies"`
	Yards     any `json:"yards"`
	Gardens   any `json:"gardens"`
}

// RoomAnswers are the room counts by type.
type RoomAnswers struct {
	Bedrooms     any `json:"bedrooms"`
	Bathrooms    any `json:"bathrooms"`
	Kitchens     any `json:"kitchens"`
	LivingRooms  any `json:"livingRooms"`
	LaundryAreas any `json:"laundryAreas"`
}

// CollectionAnswers are the weekdays (0 = Sunday to 6 = Saturday) on which
// each stream is collected. No days means no collection to put out.
type CollectionAnswers struct {
	Trash     []any `json:"trash"`
	Recycling []any `json:"recycling"`
}

// HabitAnswers are cooking and appliance habits.
type HabitAnswers struct {
	Cooking        string `json:"cooking"`
	Dishwasher     bool   `json:"dishwasher"`
	WashingMachine bool   `json:"washingMachine"`
}

// clean is Answers after validation, with defaults applied.
type clean struct {
	bedrooms, bathrooms, kitchens, livingRooms, laundryAreas int
	balconies, yards, gardens                                int
	pets                                                     []string
	trashDays, recyclingDays                                 []int
	cooking                                                  string
	dishwasher, washingMachine                               bool
}

// add records code for field unless the field already has an error.
func add(e chores.FieldErrors, field, code string) {
	if _, seen := e[field]; !seen {
		e[field] = code
	}
}

func normalise(a Answers) (clean, chores.FieldErrors) {
	errs := chores.FieldErrors{}
	var c clean

	count := func(field string, v any, hi int) int {
		if v == nil {
			return 0
		}
		f, ok := v.(float64)
		switch {
		case !ok || f != float64(int(f)):
			add(errs, field, "invalid")
		case f < 0 || f > float64(hi):
			add(errs, field, "out_of_range")
		default:
			return int(f)
		}
		return 0
	}
	if r := a.Rooms; r != nil {
		c.bedrooms = count("rooms.bedrooms", r.Bedrooms, MaxRooms)
		c.bathrooms = count("rooms.bathrooms", r.Bathrooms, MaxRooms)
		c.kitchens = count("rooms.kitchens", r.Kitchens, MaxKitchens)
		c.livingRooms = count("rooms.livingRooms", r.LivingRooms, MaxRooms)
		c.laundryAreas = count("rooms.laundryAreas", r.LaundryAreas, MaxRooms)
	}

	if o := a.Outdoor; o != nil {
		c.balconies = count("outdoor.balconies", o.Balconies, MaxOutdoor)
		c.yards = count("outdoor.yards", o.Yards, MaxOutdoor)
		c.gardens = count("outdoor.gardens", o.Gardens, MaxOutdoor)
	}

	for _, p := range a.Pets {
		if !slices.Contains(pets, p) {
			add(errs, "pets", "unknown")
		}
	}
	c.pets = a.Pets

	days := func(field string, in []any) []int {
		out := []int{}
		for _, v := range in {
			f, ok := v.(float64)
			switch {
			case !ok || f != float64(int(f)):
				add(errs, field, "invalid")
			case f < 0 || f > 6:
				add(errs, field, "out_of_range")
			default:
				out = append(out, int(f))
			}
		}
		slices.Sort(out)
		return slices.Compact(out)
	}
	if col := a.Collection; col != nil {
		c.trashDays = days("collection.trash", col.Trash)
		c.recyclingDays = days("collection.recycling", col.Recycling)
	}

	c.cooking = "sometimes"
	if h := a.Habits; h != nil {
		switch {
		case h.Cooking == "":
		case !slices.Contains(cookings, h.Cooking):
			add(errs, "habits.cooking", "unknown")
		default:
			c.cooking = h.Cooking
		}
		c.dishwasher, c.washingMachine = h.Dishwasher, h.WashingMachine
	}

	if len(errs) > 0 {
		return clean{}, errs
	}
	return c, nil
}

// ValidateAnswers reports every problem with the answers at once, as stable
// codes (invalid, out_of_range, unknown) keyed by wire name such as
// "rooms.bathrooms". nil means the answers are acceptable.
func ValidateAnswers(a Answers) chores.FieldErrors {
	_, errs := normalise(a)
	return errs
}
