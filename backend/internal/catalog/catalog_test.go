package catalog

import (
	"encoding/json"
	"testing"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// asInput round-trips Fields through JSON into the shape a client sends.
func asInput(t *testing.T, f chores.Fields) chores.Input {
	t.Helper()
	b, err := json.Marshal(f)
	if err != nil {
		t.Fatal(err)
	}
	var in chores.Input
	if err := json.Unmarshal(b, &in); err != nil {
		t.Fatal(err)
	}
	return in
}

func checkFields(t *testing.T, what string, f chores.Fields) {
	t.Helper()
	if _, errs := chores.Validate(asInput(t, f)); len(errs) > 0 {
		t.Errorf("%s is not a valid Chore: %v", what, errs)
	}
	if f.Name == "" || utf8.RuneCountInString(f.Name) > 100 {
		t.Errorf("%s has name %q, want 1 to 100 runes", what, f.Name)
	}
}

func TestEveryEntryIsAValidChoreWithAUniqueID(t *testing.T) {
	seen := map[string]bool{}
	for _, e := range Entries() {
		if e.ID == "" || seen[e.ID] {
			t.Errorf("entry id %q is empty or repeated", e.ID)
		}
		seen[e.ID] = true
		checkFields(t, "entry "+e.ID, e.Fields)
	}
}

func TestEntriesReturnsCopiesTheCallerMayChange(t *testing.T) {
	first := Entries()
	*first[0].IntervalDays = 999
	first[0].Demands[0] = "changed"
	first[0].Name = "changed"

	again := Entries()
	if *again[0].IntervalDays == 999 || again[0].Demands[0] == "changed" || again[0].Name == "changed" {
		t.Errorf("changing a returned Entry changed the Catalog: %+v", again[0])
	}
}

func roomAnswers(n int) *RoomAnswers {
	return &RoomAnswers{Bedrooms: float64(n), Bathrooms: float64(n), Kitchens: float64(min(n, MaxKitchens)),
		LivingRooms: float64(n), LaundryAreas: float64(n)}
}

func spread() []Answers {
	all := []string{"dog", "cat", "fish", "bird", "other"}
	var out []Answers
	outdoors := []*OutdoorAnswers{nil, {}}
	for _, n := range []int{1, 2, MaxOutdoor} {
		f := float64(n)
		outdoors = append(outdoors, &OutdoorAnswers{Balconies: f}, &OutdoorAnswers{Yards: f},
			&OutdoorAnswers{Gardens: f}, &OutdoorAnswers{Balconies: f, Yards: f, Gardens: f})
	}
	for _, outdoor := range outdoors {
		for _, cooking := range Cookings() {
			for _, n := range []int{0, 1, 2, MaxRooms} {
				for _, dw := range []bool{false, true} {
					out = append(out, Answers{
						Rooms: roomAnswers(n), Outdoor: outdoor, Pets: all,
						Collection: &CollectionAnswers{Trash: []any{float64(2), float64(5)}, Recycling: []any{float64(0)}},
						Habits:     &HabitAnswers{Cooking: cooking, Dishwasher: dw, WashingMachine: dw},
					})
				}
			}
		}
	}
	return append(out, Answers{})
}

func TestEveryProposalIsAValidChoreAndWithinTheBound(t *testing.T) {
	for _, a := range spread() {
		if errs := ValidateAnswers(a); errs != nil {
			t.Fatalf("spread answers invalid: %v", errs)
		}
		type key struct {
			id   string
			inst int
		}
		seen := map[key]bool{}
		ps := Propose(a)
		if len(ps) > MaxProposals {
			t.Errorf("%d proposals, want at most %d", len(ps), MaxProposals)
		}
		for _, p := range ps {
			checkFields(t, "proposal "+p.CatalogID, p.Fields)
			k := key{p.CatalogID, 0}
			if p.Instance != nil {
				k.inst = *p.Instance
			}
			if seen[k] {
				t.Errorf("proposal %v is repeated", k)
			}
			seen[k] = true
		}
	}
}
