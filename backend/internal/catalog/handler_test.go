package catalog_test

import (
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/catalog"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// inCategory keeps the proposals in one Category.
func inCategory(ps []map[string]any, category string) []map[string]any {
	out := []map[string]any{}
	for _, p := range ps {
		if p["category"] == category {
			out = append(out, p)
		}
	}
	return out
}

// catalogIDs lists the catalogId of each proposal, in order.
func catalogIDs(ps []map[string]any) []string {
	out := []string{}
	for _, p := range ps {
		out = append(out, p["catalogId"].(string))
	}
	return out
}

// one returns the single proposal with the catalogId, failing otherwise.
func one(t *testing.T, ps []map[string]any, id string) map[string]any {
	t.Helper()
	var found []map[string]any
	for _, p := range ps {
		if p["catalogId"] == id {
			found = append(found, p)
		}
	}
	if len(found) != 1 {
		t.Fatalf("proposals with catalogId %s = %v, want exactly one (all: %v)", id, found, catalogIDs(ps))
	}
	return found[0]
}

func rooms(kv map[string]any) map[string]any { return map[string]any{"rooms": kv} }

func TestOneBathroomProposesOneBathroomChore(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := inCategory(apitest.Proposals(t, me, rooms(map[string]any{"bathrooms": 1})), "bathroom")
	if len(got) != 1 {
		t.Fatalf("bathroom proposals = %v, want exactly one", got)
	}
	if got[0]["catalogId"] != "clean_bathroom" || got[0]["instance"] != nil {
		t.Fatalf("proposal = %v, want clean_bathroom with instance null", got[0])
	}
}

func TestTwoBathroomsProposeTwoBathroomChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := inCategory(apitest.Proposals(t, me, rooms(map[string]any{"bathrooms": 2})), "bathroom")
	if len(got) != 2 {
		t.Fatalf("bathroom proposals = %v, want two", got)
	}
	if got[0]["instance"] != float64(1) || got[1]["instance"] != float64(2) {
		t.Fatalf("instances = %v, %v, want 1 and 2", got[0]["instance"], got[1]["instance"])
	}
	delete(got[0], "instance")
	delete(got[1], "instance")
	if !reflect.DeepEqual(got[0], got[1]) {
		t.Fatalf("the two bathroom Chores differ: %v vs %v", got[0], got[1])
	}
}

func TestEveryRoomTypeProposesItsChoresPerRoom(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := apitest.Proposals(t, me, rooms(map[string]any{
		"bedrooms": 3, "bathrooms": 1, "kitchens": 1, "livingRooms": 2, "laundryAreas": 1,
	}))
	count := map[string]int{}
	for _, p := range got {
		count[p["catalogId"].(string)]++
	}
	for id, want := range map[string]int{
		"change_bed_linen": 3, "clean_bathroom": 1, "clean_kitchen": 1, "tidy_living_room": 2, "clean_laundry_area": 1,
	} {
		if count[id] != want {
			t.Errorf("%s proposals = %d, want %d (all: %v)", id, count[id], want, catalogIDs(got))
		}
	}
	if len(apitest.Proposals(t, me, map[string]any{})) != 0 {
		t.Errorf("empty answers should propose nothing")
	}
}

func TestPetsProposePetChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	if got := inCategory(apitest.Proposals(t, me, map[string]any{}), "pets"); len(got) != 0 {
		t.Fatalf("no pets proposed %v", got)
	}
	dog := inCategory(apitest.Proposals(t, me, map[string]any{"pets": []string{"dog"}}), "pets")
	if ids := catalogIDs(dog); !slices.Contains(ids, "walk_dog") || !slices.Contains(ids, "feed_dog") {
		t.Fatalf("dog proposals = %v, want walk and feed", ids)
	}
	cat := inCategory(apitest.Proposals(t, me, map[string]any{"pets": []string{"cat"}}), "pets")
	if ids := catalogIDs(cat); !slices.Contains(ids, "clean_litter_box") || slices.Contains(ids, "walk_dog") {
		t.Fatalf("cat proposals = %v, want a litter box and no walk", ids)
	}
	both := inCategory(apitest.Proposals(t, me, map[string]any{"pets": []string{"dog", "cat", "dog"}}), "pets")
	if len(both) != len(dog)+len(cat) {
		t.Fatalf("dog and cat proposals = %d, want %d (a repeated pet adds nothing)", len(both), len(dog)+len(cat))
	}
}

func TestCollectionDaysSetWeekdayLimits(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := apitest.Proposals(t, me, map[string]any{"collection": map[string]any{
		"trash": []int{5, 2, 2}, "recycling": []int{},
	}})
	trash := one(t, got, "put_out_trash")
	if !reflect.DeepEqual(trash["allowedWeekdays"], []any{float64(2), float64(5)}) ||
		trash["intervalDays"] != float64(7) || trash["importance"] != "essential" || trash["category"] != "trash" {
		t.Fatalf("trash proposal = %v, want weekly, essential, on weekdays 2 and 5", trash)
	}
	if slices.Contains(catalogIDs(got), "put_out_recycling") {
		t.Fatalf("recycling without days proposed a Chore: %v", catalogIDs(got))
	}
	both := apitest.Proposals(t, me, map[string]any{"collection": map[string]any{"trash": []int{1}, "recycling": []int{4}}})
	if r := one(t, both, "put_out_recycling"); !reflect.DeepEqual(r["allowedWeekdays"], []any{float64(4)}) {
		t.Fatalf("recycling proposal = %v, want weekday 4", r)
	}
}

func TestOutdoorAreasProposeOutdoorChoresPerArea(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	outdoor := func(counts map[string]any) []map[string]any {
		return inCategory(apitest.Proposals(t, me, map[string]any{"outdoor": counts}), "outdoor")
	}
	instances := func(ps []map[string]any, id string) []any {
		out := []any{}
		for _, p := range ps {
			if p["catalogId"] == id {
				out = append(out, p["instance"])
			}
		}
		return out
	}

	t.Run("two gardens", func(t *testing.T) {
		got := outdoor(map[string]any{"gardens": 2})
		for _, id := range []string{"sweep_yard", "weed_garden", "water_garden"} {
			var pair []map[string]any
			for _, p := range got {
				if p["catalogId"] == id {
					pair = append(pair, p)
				}
			}
			if len(pair) != 2 {
				t.Fatalf("%s proposals = %d, want two (all: %v)", id, len(pair), catalogIDs(got))
			}
			if pair[0]["instance"] != float64(1) || pair[1]["instance"] != float64(2) {
				t.Fatalf("%s instances = %v, %v, want 1 and 2", id, pair[0]["instance"], pair[1]["instance"])
			}
			delete(pair[0], "instance")
			delete(pair[1], "instance")
			if !reflect.DeepEqual(pair[0], pair[1]) {
				t.Fatalf("the two %s Chores differ: %v vs %v", id, pair[0], pair[1])
			}
		}
		if len(got) != 6 {
			t.Fatalf("two gardens proposed %v, want six", catalogIDs(got))
		}
	})
	t.Run("a yard and two gardens", func(t *testing.T) {
		got := outdoor(map[string]any{"yards": 1, "gardens": 2})
		if sweep := instances(got, "sweep_yard"); !reflect.DeepEqual(sweep, []any{float64(1), float64(2), float64(3)}) {
			t.Fatalf("sweep_yard instances = %v, want 1 to 3", sweep)
		}
		if mow := instances(got, "mow_lawn"); !reflect.DeepEqual(mow, []any{nil}) {
			t.Fatalf("mow_lawn instances = %v, want one with instance null", mow)
		}
	})
	t.Run("a balcony", func(t *testing.T) {
		got := outdoor(map[string]any{"balconies": 1})
		if !reflect.DeepEqual(catalogIDs(got), []string{"sweep_balcony"}) || got[0]["instance"] != nil {
			t.Fatalf("balcony proposed %v, want one sweep_balcony with instance null", got)
		}
	})
	t.Run("a weeding Chore bends", func(t *testing.T) {
		weed := one(t, outdoor(map[string]any{"gardens": 1}), "weed_garden")
		if !slices.Contains(weed["demands"].([]any), any("bending")) {
			t.Fatalf("weeding demands = %v, want bending", weed["demands"])
		}
	})
	t.Run("no outdoor area", func(t *testing.T) {
		for name, body := range map[string]map[string]any{
			"missing": {},
			"empty":   {"outdoor": map[string]any{}},
			"zeros":   {"outdoor": map[string]any{"balconies": 0, "yards": 0, "gardens": 0}},
			"nulls":   {"outdoor": map[string]any{"balconies": nil, "gardens": nil}},
		} {
			if got := inCategory(apitest.Proposals(t, me, body), "outdoor"); len(got) != 0 {
				t.Errorf("%s proposed %v", name, got)
			}
		}
	})
	t.Run("outdoor areas alone propose no floor Chores", func(t *testing.T) {
		got := apitest.Proposals(t, me, map[string]any{"outdoor": map[string]any{"balconies": 2, "yards": 2, "gardens": 2}})
		if floors := inCategory(got, "floors"); len(floors) != 0 {
			t.Fatalf("outdoor areas proposed floors %v", floors)
		}
	})
}

func TestHabitsChangeTheChoresNotOnlyTheirNumber(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	kitchen := map[string]any{"kitchens": 1}
	habits := func(h map[string]any) []map[string]any {
		return apitest.Proposals(t, me, map[string]any{"rooms": kitchen, "habits": h})
	}

	if ids := catalogIDs(habits(map[string]any{})); !slices.Contains(ids, "wash_dishes") || slices.Contains(ids, "load_dishwasher") {
		t.Fatalf("no dishwasher proposed %v, want washing the dishes", ids)
	}
	if ids := catalogIDs(habits(map[string]any{"dishwasher": true})); slices.Contains(ids, "wash_dishes") || !slices.Contains(ids, "load_dishwasher") {
		t.Fatalf("dishwasher proposed %v, want loading it instead of washing", ids)
	}

	daily := one(t, habits(map[string]any{"cooking": "daily"}), "clean_kitchen")
	rarely := one(t, habits(map[string]any{"cooking": "rarely"}), "clean_kitchen")
	if daily["intervalDays"].(float64) >= rarely["intervalDays"].(float64) || daily["baseEffort"].(float64) < rarely["baseEffort"].(float64) {
		t.Fatalf("daily cooking %v vs rarely %v: want more often and no lighter", daily, rarely)
	}
	if ids := catalogIDs(habits(map[string]any{"cooking": "rarely"})); slices.Contains(ids, "clean_oven") {
		t.Fatalf("rarely cooking proposed the oven: %v", ids)
	}

	laundry := func(machine bool) []map[string]any {
		return inCategory(apitest.Proposals(t, me, map[string]any{"habits": map[string]any{"washingMachine": machine}}), "laundry")
	}
	if len(laundry(false)) != 0 || len(laundry(true)) == 0 {
		t.Fatalf("laundry without machine %v, with %v: want none and some", laundry(false), laundry(true))
	}
}

func TestTheSameAnswersGiveTheSameProposalsInTheSameOrder(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	answers := map[string]any{
		"rooms":      map[string]any{"bedrooms": 3, "bathrooms": 2, "kitchens": 1, "livingRooms": 1, "laundryAreas": 1},
		"outdoor":    map[string]any{"gardens": 2},
		"pets":       []string{"cat", "dog", "bird"},
		"collection": map[string]any{"trash": []int{2, 5}, "recycling": []int{3}},
		"habits":     map[string]any{"cooking": "daily", "dishwasher": true, "washingMachine": true},
	}
	a := me.Post("/catalog/proposals", answers)
	b := me.Post("/catalog/proposals", answers)
	if a.Status != http.StatusOK || string(a.Raw) != string(b.Raw) {
		t.Fatalf("two calls differ:\n%s\n%s", a.Raw, b.Raw)
	}
}

func TestTheLargestAnswersStayWithinTheProposalBound(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := apitest.Proposals(t, me, map[string]any{
		"rooms":      map[string]any{"bedrooms": 10, "bathrooms": 10, "kitchens": 3, "livingRooms": 10, "laundryAreas": 10},
		"outdoor":    map[string]any{"balconies": 10, "yards": 10, "gardens": 10},
		"pets":       []string{"dog", "cat", "fish", "bird", "other"},
		"collection": map[string]any{"trash": []int{1}, "recycling": []int{2}},
		"habits":     map[string]any{"cooking": "daily", "washingMachine": true},
	})
	if len(got) > catalog.MaxProposals {
		t.Fatalf("proposals = %d, want at most %d", len(got), catalog.MaxProposals)
	}
}

func TestInvalidAnswersAreRejectedWithFieldCodesAllAtOnce(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	cases := []struct {
		name   string
		body   string
		status int
		fields map[string]string
	}{
		{"negative rooms", `{"rooms":{"bathrooms":-1}}`, 400, map[string]string{"rooms.bathrooms": "out_of_range"}},
		{"too many rooms", `{"rooms":{"bedrooms":11}}`, 400, map[string]string{"rooms.bedrooms": "out_of_range"}},
		{"too many kitchens", `{"rooms":{"kitchens":4}}`, 400, map[string]string{"rooms.kitchens": "out_of_range"}},
		{"string count", `{"rooms":{"livingRooms":"two"}}`, 400, map[string]string{"rooms.livingRooms": "invalid"}},
		{"fractional count", `{"rooms":{"laundryAreas":2.5}}`, 400, map[string]string{"rooms.laundryAreas": "invalid"}},
		{"too many gardens", `{"outdoor":{"gardens":11}}`, 400, map[string]string{"outdoor.gardens": "out_of_range"}},
		{"negative gardens", `{"outdoor":{"gardens":-1}}`, 400, map[string]string{"outdoor.gardens": "out_of_range"}},
		{"fractional gardens", `{"outdoor":{"gardens":2.5}}`, 400, map[string]string{"outdoor.gardens": "invalid"}},
		{"string yards", `{"outdoor":{"yards":"two"}}`, 400, map[string]string{"outdoor.yards": "invalid"}},
		{"too many balconies", `{"outdoor":{"balconies":11}}`, 400, map[string]string{"outdoor.balconies": "out_of_range"}},
		{"unknown outdoor type", `{"outdoor":{"pools":1}}`, 400, nil},
		{"old outdoor string", `{"outdoor":"garden"}`, 400, nil},
		{"unknown pet", `{"pets":["dog","dragon"]}`, 400, map[string]string{"pets": "unknown"}},
		{"weekday 7", `{"collection":{"trash":[7]}}`, 400, map[string]string{"collection.trash": "out_of_range"}},
		{"string weekday", `{"collection":{"recycling":["tue"]}}`, 400, map[string]string{"collection.recycling": "invalid"}},
		{"unknown cooking", `{"habits":{"cooking":"always"}}`, 400, map[string]string{"habits.cooking": "unknown"}},
		{"all at once", `{"rooms":{"bathrooms":-1,"bedrooms":"x"},"outdoor":{"gardens":11,"yards":"x"},"collection":{"trash":[9]}}`, 400, map[string]string{
			"rooms.bathrooms": "out_of_range", "rooms.bedrooms": "invalid", "outdoor.gardens": "out_of_range", "outdoor.yards": "invalid", "collection.trash": "out_of_range",
		}},
		{"unknown field", `{"swimmingPool":true}`, 400, nil},
		{"unknown nested field", `{"rooms":{"attics":1}}`, 400, nil},
		{"malformed JSON", `{"rooms":`, 400, nil},
		{"oversized", `{"pets":["` + strings.Repeat("a", 5000) + `"]}`, 413, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := me.SendRaw(http.MethodPost, "/catalog/proposals", []byte(tc.body))
			if r.Status != tc.status {
				t.Fatalf("status = %d %s, want %d", r.Status, r.Raw, tc.status)
			}
			if tc.fields == nil {
				return
			}
			if r.Body["error"] != "invalid answers" {
				t.Errorf("error = %v, want invalid answers", r.Body["error"])
			}
			got := map[string]string{}
			for k, v := range r.Body["fields"].(map[string]any) {
				got[k] = v.(string)
			}
			if !reflect.DeepEqual(got, tc.fields) {
				t.Errorf("fields = %v, want %v", got, tc.fields)
			}
		})
	}

	// A missing section means none, not an error.
	for _, body := range []string{`{}`, `{"rooms":{}}`, `{"outdoor":{}}`, `{"outdoor":null}`, `{"rooms":null,"pets":null,"habits":{}}`, `{"collection":{}}`} {
		if r := me.SendRaw(http.MethodPost, "/catalog/proposals", []byte(body)); r.Status != http.StatusOK {
			t.Errorf("%s = %d %s, want 200", body, r.Status, r.Raw)
		}
	}
}

func TestCatalogRoutesNeedASignedInUserButNoHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com") // no Home

	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/catalog"}, {http.MethodPost, "/catalog/proposals"},
	} {
		var body any
		if route.method == http.MethodPost {
			body = map[string]any{}
		}
		if r := app.Do(route.method, route.path, nil); r.Status != http.StatusUnauthorized {
			t.Errorf("%s %s without a token = %d, want 401", route.method, route.path, r.Status)
		}
		if r := me.Do(route.method, route.path, body, nil); r.Status != http.StatusOK {
			t.Errorf("%s %s without a Home = %d %s, want 200", route.method, route.path, r.Status, r.Raw)
		}
	}

	noAuth := apitest.Start(t, apitest.WithoutAuth())
	if r := noAuth.Get("/catalog"); r.Status != http.StatusServiceUnavailable {
		t.Errorf("GET /catalog without auth configured = %d, want 503", r.Status)
	}
	if r := noAuth.Post("/catalog/proposals", map[string]any{}); r.Status != http.StatusServiceUnavailable {
		t.Errorf("POST /catalog/proposals without auth configured = %d, want 503", r.Status)
	}
}

func TestTheCatalogListsEveryEntryInAStableOrderWithUniqueIDs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	first := apitest.CatalogEntries(t, me)
	seen := map[string]bool{}
	for _, e := range first {
		id, _ := e["id"].(string)
		if id == "" || seen[id] {
			t.Fatalf("entry id %q is empty or repeated", id)
		}
		seen[id] = true
		for _, k := range []string{"name", "category", "demands", "baseEffort", "importance", "people",
			"intervalDays", "allowedWeekdays", "buildsUp", "perRoom"} {
			if _, ok := e[k]; !ok {
				t.Errorf("entry %s has no %s", id, k)
			}
		}
	}
	if !reflect.DeepEqual(first, apitest.CatalogEntries(t, me)) {
		t.Errorf("two calls list the Catalog differently")
	}
	for _, e := range first {
		if e["id"] == "clean_bathroom" && e["perRoom"] != true {
			t.Errorf("clean_bathroom perRoom = %v, want true", e["perRoom"])
		}
	}
}
