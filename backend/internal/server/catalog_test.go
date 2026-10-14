package server_test

import (
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/catalog"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// proposals posts answers and returns the proposals array, failing on a non-200.
func proposals(t *testing.T, c *apitest.Client, answers any) []map[string]any {
	t.Helper()
	r := c.Post("/catalog/proposals", answers)
	if r.Status != http.StatusOK {
		t.Fatalf("POST /catalog/proposals = %d %s, want 200", r.Status, r.Raw)
	}
	raw, ok := r.Body["proposals"].([]any)
	if !ok {
		t.Fatalf("no proposals array: %s", r.Raw)
	}
	out := make([]map[string]any, len(raw))
	for i, p := range raw {
		out[i] = p.(map[string]any)
	}
	return out
}

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

	got := inCategory(proposals(t, me, rooms(map[string]any{"bathrooms": 1})), "bathroom")
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

	got := inCategory(proposals(t, me, rooms(map[string]any{"bathrooms": 2})), "bathroom")
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

	got := proposals(t, me, rooms(map[string]any{
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
	if len(proposals(t, me, map[string]any{})) != 0 {
		t.Errorf("empty answers should propose nothing")
	}
}

func TestPetsProposePetChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	if got := inCategory(proposals(t, me, map[string]any{}), "pets"); len(got) != 0 {
		t.Fatalf("no pets proposed %v", got)
	}
	dog := inCategory(proposals(t, me, map[string]any{"pets": []string{"dog"}}), "pets")
	if ids := catalogIDs(dog); !slices.Contains(ids, "walk_dog") || !slices.Contains(ids, "feed_dog") {
		t.Fatalf("dog proposals = %v, want walk and feed", ids)
	}
	cat := inCategory(proposals(t, me, map[string]any{"pets": []string{"cat"}}), "pets")
	if ids := catalogIDs(cat); !slices.Contains(ids, "clean_litter_box") || slices.Contains(ids, "walk_dog") {
		t.Fatalf("cat proposals = %v, want a litter box and no walk", ids)
	}
	both := inCategory(proposals(t, me, map[string]any{"pets": []string{"dog", "cat", "dog"}}), "pets")
	if len(both) != len(dog)+len(cat) {
		t.Fatalf("dog and cat proposals = %d, want %d (a repeated pet adds nothing)", len(both), len(dog)+len(cat))
	}
}

func TestCollectionDaysSetWeekdayLimits(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	got := proposals(t, me, map[string]any{"collection": map[string]any{
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
	both := proposals(t, me, map[string]any{"collection": map[string]any{"trash": []int{1}, "recycling": []int{4}}})
	if r := one(t, both, "put_out_recycling"); !reflect.DeepEqual(r["allowedWeekdays"], []any{float64(4)}) {
		t.Fatalf("recycling proposal = %v, want weekday 4", r)
	}
}

func TestOutdoorSpaceProposesOutdoorChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	outdoor := func(space string) []map[string]any {
		return inCategory(proposals(t, me, map[string]any{"outdoor": space}), "outdoor")
	}
	if got := outdoor("none"); len(got) != 0 {
		t.Fatalf("none proposed %v", got)
	}
	if got := catalogIDs(outdoor("balcony")); !reflect.DeepEqual(got, []string{"sweep_balcony"}) {
		t.Fatalf("balcony proposed %v, want one light Chore", got)
	}
	yard := outdoor("yard")
	if ids := catalogIDs(yard); !slices.Contains(ids, "mow_lawn") {
		t.Fatalf("yard proposed %v, want mowing", ids)
	}
	garden := outdoor("garden")
	weed := one(t, garden, "weed_garden")
	if !slices.Contains(weed["demands"].([]any), any("bending")) {
		t.Fatalf("weeding demands = %v, want bending", weed["demands"])
	}
}

func TestHabitsChangeTheChoresNotOnlyTheirNumber(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	kitchen := map[string]any{"kitchens": 1}
	habits := func(h map[string]any) []map[string]any {
		return proposals(t, me, map[string]any{"rooms": kitchen, "habits": h})
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
		return inCategory(proposals(t, me, map[string]any{"habits": map[string]any{"washingMachine": machine}}), "laundry")
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
		"outdoor":    "garden",
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

	got := proposals(t, me, map[string]any{
		"rooms":      map[string]any{"bedrooms": 10, "bathrooms": 10, "kitchens": 3, "livingRooms": 10, "laundryAreas": 10},
		"outdoor":    "garden",
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
		{"unknown outdoor", `{"outdoor":"rooftop"}`, 400, map[string]string{"outdoor": "unknown"}},
		{"unknown pet", `{"pets":["dog","dragon"]}`, 400, map[string]string{"pets": "unknown"}},
		{"weekday 7", `{"collection":{"trash":[7]}}`, 400, map[string]string{"collection.trash": "out_of_range"}},
		{"string weekday", `{"collection":{"recycling":["tue"]}}`, 400, map[string]string{"collection.recycling": "invalid"}},
		{"unknown cooking", `{"habits":{"cooking":"always"}}`, 400, map[string]string{"habits.cooking": "unknown"}},
		{"all at once", `{"rooms":{"bathrooms":-1,"bedrooms":"x"},"outdoor":"moon","collection":{"trash":[9]}}`, 400, map[string]string{
			"rooms.bathrooms": "out_of_range", "rooms.bedrooms": "invalid", "outdoor": "unknown", "collection.trash": "out_of_range",
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
	for _, body := range []string{`{}`, `{"rooms":{}}`, `{"rooms":null,"pets":null,"habits":{}}`, `{"collection":{}}`} {
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

func catalogEntries(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	r := c.Get("/catalog")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /catalog = %d %s", r.Status, r.Raw)
	}
	raw, ok := r.Body["entries"].([]any)
	if !ok || len(raw) == 0 {
		t.Fatalf("no entries: %s", r.Raw)
	}
	out := make([]map[string]any, len(raw))
	for i, e := range raw {
		out[i] = e.(map[string]any)
	}
	return out
}

func TestTheCatalogListsEveryEntryInAStableOrderWithUniqueIDs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	first := catalogEntries(t, me)
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
	if !reflect.DeepEqual(first, catalogEntries(t, me)) {
		t.Errorf("two calls list the Catalog differently")
	}
	for _, e := range first {
		if e["id"] == "clean_bathroom" && e["perRoom"] != true {
			t.Errorf("clean_bathroom perRoom = %v, want true", e["perRoom"])
		}
	}
}
