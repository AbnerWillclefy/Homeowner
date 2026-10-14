package homes_test

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func countHomes(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM homes").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// homeWithChores is a Home body carrying reviewed Chores.
func homeWithChores(cs ...map[string]any) map[string]any {
	b := apitest.HomeBody("UTC", "07:00")
	b["chores"] = cs
	return b
}

func TestCreatingAHomeWithReviewedChoresStoresExactlyThoseChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	// The questionnaire proposes; the User removes one and edits another.
	ps := apitest.Proposals(t, me, map[string]any{
		"rooms": map[string]any{"bathrooms": 2, "kitchens": 1}, "pets": []string{"dog"},
	})
	var reviewed []map[string]any
	removed, edited := "feed_dog", "walk_dog"
	for _, p := range ps {
		if p["catalogId"] == removed {
			continue
		}
		c := map[string]any{}
		for _, k := range []string{"name", "category", "demands", "baseEffort", "importance", "people", "intervalDays", "allowedWeekdays", "buildsUp"} {
			c[k] = p[k]
		}
		if p["catalogId"] == edited {
			c["name"] = "  Walk Rex  "
			c["intervalDays"] = 2
			c["demands"] = []string{"heights", "bending", "bending"}
		}
		reviewed = append(reviewed, c)
	}

	created := me.Post("/home", homeWithChores(reviewed...))
	if created.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s, want 201", created.Status, created.Raw)
	}
	got := apitest.ListChores(t, me)
	if len(got) != len(reviewed) || len(reviewed) != len(ps)-1 {
		t.Fatalf("stored %d Chores, sent %d of %d proposed", len(got), len(reviewed), len(ps))
	}
	names := map[string]map[string]any{}
	for _, c := range got {
		m := c.(map[string]any)
		names[m["name"].(string)] = m
	}
	if _, ok := names["Feed the dog"]; ok {
		t.Errorf("the removed proposal was stored")
	}
	walk := names["Walk Rex"]
	if walk == nil || walk["intervalDays"] != float64(2) || !reflect.DeepEqual(walk["demands"], []any{"bending", "heights"}) {
		t.Errorf("edited Chore = %v, want trimmed name, interval 2 and normalised demands", walk)
	}
}

func TestInvalidChoreInANewHomeStoresNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	body := apitest.HomeBody("Nope/Nowhere", "07:00")
	body["chores"] = []map[string]any{
		apitest.ValidChore(),
		apitest.ValidChore(),
		apitest.WithField(apitest.WithField(apitest.ValidChore(), "baseEffort", 9), "category", "garage"),
	}
	r := me.Post("/home", body)
	if r.Status != http.StatusBadRequest || r.Body["error"] != "invalid home" {
		t.Fatalf("POST /home = %d %s, want 400 invalid home", r.Status, r.Raw)
	}
	want := map[string]any{"timezone": "unknown", "chores.2.baseEffort": "out_of_range", "chores.2.category": "unknown"}
	if !reflect.DeepEqual(r.Body["fields"], want) {
		t.Fatalf("fields = %v, want %v (home and Chore errors at once)", r.Body["fields"], want)
	}
	if h, c := countHomes(t, app), apitest.CountChores(t, app); h != 0 || c != 0 {
		t.Fatalf("stored %d Homes and %d Chores, want none", h, c)
	}
	if got := me.Get("/home"); got.Status != http.StatusNotFound {
		t.Fatalf("GET /home = %d, want 404 (no Home was made)", got.Status)
	}
}

func TestACreateThatLosesTheRaceAddsNoChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	me.Post("/home/chores", apitest.ValidChore())

	second := me.Post("/home", homeWithChores(apitest.ValidChore(), apitest.ValidChore()))
	if second.Status != http.StatusConflict {
		t.Fatalf("second POST /home = %d %s, want 409", second.Status, second.Raw)
	}
	if n := apitest.CountChores(t, app); n != 1 {
		t.Fatalf("Chores = %d, want 1 (the 409 added none)", n)
	}
}

func TestConcurrentCreatesWithChoresMakeOneHomeWithOneSetOfChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Get("/me")

	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			me.Post("/home", homeWithChores(apitest.ValidChore(), apitest.ValidChore(), apitest.ValidChore()))
		}()
	}
	wg.Wait()
	if h, c := countHomes(t, app), apitest.CountChores(t, app); h != 1 || c != 3 {
		t.Fatalf("Homes = %d, Chores = %d, want 1 and 3", h, c)
	}
}

func TestCreatingAHomeWithoutOrWithEmptyChoresAddsNone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	for i, chores := range []any{nil, []any{}} {
		me := app.SignInAs(fmt.Sprintf("u%d@example.com", i))
		body := apitest.HomeBody("UTC", "07:00")
		if chores != nil {
			body["chores"] = chores
		}
		if r := me.Post("/home", body); r.Status != http.StatusCreated {
			t.Fatalf("POST /home = %d %s, want 201", r.Status, r.Raw)
		}
	}
	b := app.SignInAs("null@example.com")
	if r := b.Post("/home", apitest.WithField(apitest.HomeBody("UTC", "07:00"), "chores", nil)); r.Status != http.StatusCreated {
		t.Fatalf("null chores = %d %s, want 201", r.Status, r.Raw)
	}
	if n := apitest.CountChores(t, app); n != 0 {
		t.Fatalf("Chores = %d, want 0", n)
	}
}

func TestTheChoresListOfANewHomeIsBoundedAndPutHomeTakesNoChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	many := make([]map[string]any, 101)
	for i := range many {
		many[i] = apitest.ValidChore()
	}
	r := me.Post("/home", apitest.WithField(apitest.HomeBody("UTC", "07:00"), "chores", many))
	if r.Status != http.StatusBadRequest || !reflect.DeepEqual(r.Body["fields"], map[string]any{"chores": "too_many"}) {
		t.Fatalf("101 Chores = %d %s, want 400 chores too_many", r.Status, r.Raw)
	}
	if n := countHomes(t, app); n != 0 {
		t.Fatalf("Homes = %d, want 0", n)
	}

	huge := apitest.WithField(apitest.HomeBody("UTC", "07:00"), "chores", []map[string]any{apitest.WithField(apitest.ValidChore(), "name", strings.Repeat("x", 70*1024))})
	if r := me.Post("/home", huge); r.Status != http.StatusRequestEntityTooLarge {
		t.Fatalf("70 KB body = %d, want 413", r.Status)
	}

	me.Post("/home", apitest.HomeBody("UTC", "07:00"))
	if r := me.Put("/home", homeWithChores(apitest.ValidChore())); r.Status != http.StatusBadRequest {
		t.Fatalf("PUT /home with chores = %d %s, want 400", r.Status, r.Raw)
	}
}

func TestCatalogChoresCanBeAddedToAnExistingHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	other := apitest.HomeWithResident(t, app, "b@example.com")

	var entry map[string]any
	for _, e := range apitest.CatalogEntries(t, me) {
		if e["id"] == "mow_lawn" {
			entry = e
		}
	}
	body := map[string]any{}
	for _, k := range []string{"name", "category", "demands", "baseEffort", "importance", "people", "intervalDays", "allowedWeekdays", "buildsUp"} {
		body[k] = entry[k]
	}
	if r := me.Post("/home/chores", body); r.Status != http.StatusCreated {
		t.Fatalf("POST /home/chores = %d %s, want 201", r.Status, r.Raw)
	}
	got := apitest.ListChores(t, me)
	if len(got) != 1 || got[0].(map[string]any)["name"] != entry["name"] || got[0].(map[string]any)["category"] != "outdoor" {
		t.Fatalf("Chores = %v, want the Catalog entry", got)
	}
	if l := apitest.ListChores(t, other); len(l) != 0 {
		t.Fatalf("another Home sees %v", l)
	}
}

func TestAUserCreatesAHomeAndReadsItBack(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	created := me.Post("/home", apitest.HomeBody("America/Sao_Paulo", "07:30"))
	if created.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s, want 201", created.Status, created.Raw)
	}
	if created.Body["id"] == "" || created.Body["id"] == nil {
		t.Fatalf("created Home has no id: %s", created.Raw)
	}

	got := me.Get("/home")
	if got.Status != http.StatusOK {
		t.Fatalf("GET /home = %d %s, want 200", got.Status, got.Raw)
	}
	if got.Body["id"] != created.Body["id"] || got.Body["timezone"] != "America/Sao_Paulo" || got.Body["allocationTime"] != "07:30" {
		t.Fatalf("GET /home = %s, want the created settings", got.Raw)
	}
}

func TestASecondHomeForTheSameUserIsRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", apitest.HomeBody("UTC", "07:00"))

	second := me.Post("/home", apitest.HomeBody("Europe/Lisbon", "08:00"))
	if second.Status != http.StatusConflict || second.Body["error"] != "already a resident" {
		t.Fatalf("second POST = %d %s, want 409 already a resident", second.Status, second.Raw)
	}
	got := me.Get("/home")
	if got.Body["timezone"] != "UTC" || got.Body["allocationTime"] != "07:00" {
		t.Fatalf("GET /home = %s, want the first settings", got.Raw)
	}
	if n := countHomes(t, app); n != 1 {
		t.Fatalf("homes = %d, want 1 (no orphan from the rejected create)", n)
	}
}

func TestConcurrentCreatesMakeOneHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Get("/me") // the User exists before the race

	const n = 8
	statuses := make([]int, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = me.Post("/home", apitest.HomeBody("UTC", "07:00")).Status
		}()
	}
	wg.Wait()

	created := 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v, want only 201 and 409", statuses)
		}
	}
	if created != 1 {
		t.Fatalf("statuses = %v, want exactly one 201", statuses)
	}
	if got := countHomes(t, app); got != 1 {
		t.Fatalf("homes = %d, want 1", got)
	}
}

func TestDifferentUsersGetTheirOwnHomes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := app.SignInAs("a@example.com")
	b := app.SignInAs("b@example.com")

	ra := a.Post("/home", apitest.HomeBody("UTC", "07:00"))
	rb := b.Post("/home", apitest.HomeBody("Asia/Tokyo", "09:15"))
	if ra.Status != http.StatusCreated || rb.Status != http.StatusCreated {
		t.Fatalf("creates = %d, %d, want 201 both", ra.Status, rb.Status)
	}
	if ra.Body["id"] == rb.Body["id"] {
		t.Fatalf("both Users got Home %v", ra.Body["id"])
	}
	if got := b.Get("/home"); got.Body["timezone"] != "Asia/Tokyo" {
		t.Fatalf("b GET /home = %s, want b's own Home", got.Raw)
	}
	if got := a.Get("/home"); got.Body["timezone"] != "UTC" {
		t.Fatalf("a GET /home = %s, want a's own Home", got.Raw)
	}
}

func TestHomeRoutesWithoutAHomeOrAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for _, tc := range []struct {
		method string
		body   any
	}{{http.MethodGet, nil}, {http.MethodPut, apitest.HomeBody("UTC", "07:00")}} {
		res := me.Do(tc.method, "/home", tc.body, nil)
		if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
			t.Errorf("%s /home without a Home = %d %s, want 404 no home", tc.method, res.Status, res.Raw)
		}
	}
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut} {
		if res := app.Do(method, "/home", nil); res.Status != http.StatusUnauthorized {
			t.Errorf("%s /home without a token = %d, want 401", method, res.Status)
		}
	}
	if n := countHomes(t, app); n != 0 {
		t.Fatalf("homes = %d, want 0", n)
	}
}

func TestHomeRoutesAnswer503WhenAuthIsNotConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithoutAuth())
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut} {
		if res := app.Do(method, "/home", nil); res.Status != http.StatusServiceUnavailable {
			t.Errorf("%s /home = %d, want 503", method, res.Status)
		}
	}
}

func TestEditingTheHomeSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", apitest.HomeBody("UTC", "07:00"))

	put := me.Put("/home", apitest.HomeBody("America/Sao_Paulo", "18:45"))
	if put.Status != http.StatusOK || put.Body["timezone"] != "America/Sao_Paulo" || put.Body["allocationTime"] != "18:45" {
		t.Fatalf("PUT /home = %d %s, want 200 with the new settings", put.Status, put.Raw)
	}
	got := me.Get("/home")
	if got.Body["timezone"] != "America/Sao_Paulo" || got.Body["allocationTime"] != "18:45" {
		t.Fatalf("GET /home = %s, want the new settings", got.Raw)
	}
}

func TestInvalidHomeSettingsAreRejectedWithFieldCodes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	me.Post("/home", apitest.HomeBody("UTC", "07:00"))

	cases := []struct {
		name   string
		body   map[string]any
		fields map[string]string
	}{
		{"empty timezone", apitest.HomeBody("", "07:00"), map[string]string{"timezone": "required"}},
		{"unknown timezone", apitest.HomeBody("Mars/Olympus", "07:00"), map[string]string{"timezone": "unknown"}},
		{"Local timezone", apitest.HomeBody("Local", "07:00"), map[string]string{"timezone": "unknown"}},
		{"missing time", map[string]any{"timezone": "UTC"}, map[string]string{"allocationTime": "required"}},
		{"unpadded time", apitest.HomeBody("UTC", "7:5"), map[string]string{"allocationTime": "invalid"}},
		{"hour out of range", apitest.HomeBody("UTC", "25:00"), map[string]string{"allocationTime": "invalid"}},
		{"seconds", apitest.HomeBody("UTC", "07:00:00"), map[string]string{"allocationTime": "invalid"}},
		{"not a quarter hour", apitest.HomeBody("UTC", "07:10"), map[string]string{"allocationTime": "not_quarter_hour"}},
		{"both wrong", apitest.HomeBody("Nope", "07:10"), map[string]string{"timezone": "unknown", "allocationTime": "not_quarter_hour"}},
	}
	for _, tc := range cases {
		for _, method := range []string{http.MethodPost, http.MethodPut} {
			res := me.Do(method, "/home", tc.body, nil)
			if res.Status != http.StatusBadRequest || res.Body["error"] != "invalid home" {
				t.Errorf("%s %s = %d %s, want 400 invalid home", tc.name, method, res.Status, res.Raw)
				continue
			}
			fields, _ := res.Body["fields"].(map[string]any)
			if len(fields) != len(tc.fields) {
				t.Errorf("%s %s fields = %v, want %v", tc.name, method, fields, tc.fields)
			}
			for k, want := range tc.fields {
				if fields[k] != want {
					t.Errorf("%s %s fields[%s] = %v, want %s", tc.name, method, k, fields[k], want)
				}
			}
		}
	}

	got := me.Get("/home")
	if got.Body["timezone"] != "UTC" || got.Body["allocationTime"] != "07:00" {
		t.Fatalf("GET /home = %s, want the settings unchanged", got.Raw)
	}
}

func TestInvalidHomeBodiesAreRejected(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for name, raw := range map[string]string{
		"not JSON":      `{`,
		"unknown field": `{"timezone":"UTC","allocationTime":"07:00","extra":1}`,
		"wrong type":    `{"timezone":5,"allocationTime":"07:00"}`,
	} {
		if res := me.SendRaw(http.MethodPost, "/home", []byte(raw)); res.Status != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, res.Status, res.Raw)
		}
	}
	big := []byte(`{"timezone":"` + strings.Repeat("a", 70*1024) + `"}`) // over POST /home's 64 KB cap
	if res := me.SendRaw(http.MethodPost, "/home", big); res.Status != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized body = %d, want 413", res.Status)
	}
	if n := countHomes(t, app); n != 0 {
		t.Fatalf("homes = %d, want 0", n)
	}
}

func TestAnyResidentCanEditTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	owner := app.SignInAs("a@example.com")
	home := owner.Post("/home", apitest.HomeBody("UTC", "07:00"))

	other := app.SignInAs("b@example.com")
	other.JoinHome(t, home.Body["id"].(string))

	put := other.Put("/home", apitest.HomeBody("Europe/Lisbon", "21:00"))
	if put.Status != http.StatusOK {
		t.Fatalf("second Resident PUT /home = %d %s, want 200", put.Status, put.Raw)
	}
	got := owner.Get("/home")
	if got.Body["timezone"] != "Europe/Lisbon" || got.Body["allocationTime"] != "21:00" {
		t.Fatalf("first Resident GET /home = %s, want the second Resident's edit", got.Raw)
	}
	if n := other.Post("/home", apitest.HomeBody("UTC", "07:00")).Status; n != http.StatusConflict {
		t.Fatalf("a Resident creating another Home = %d, want 409", n)
	}
}

func TestAResidentOfATwoResidentHomeLeavesAndTheHomeRemains(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"]
	apitest.ChoreIn(t, a, "kitchen", []string{})
	b := apitest.ExtraResident(t, app, a, "b@example.com")

	r := apitest.LeaveHome(b)
	apitest.ExpectStatus(t, r, http.StatusNoContent)
	if len(r.Raw) != 0 {
		t.Errorf("body = %q, want none", r.Raw)
	}
	apitest.ExpectStatus(t, b.Get("/home"), http.StatusNotFound)
	if got := a.Get("/home"); got.Status != http.StatusOK || got.Body["id"] != homeID {
		t.Errorf("remaining Resident's GET /home = %d %s, want the Home", got.Status, got.Raw)
	}
	if n := countHomes(t, app); n != 1 {
		t.Errorf("homes = %d, want 1", n)
	}
	if n := len(apitest.ListChores(t, a)); n != 1 {
		t.Errorf("chores = %d, want 1 kept", n)
	}
}

func TestLeavingRemovesOnlyTheLeaversSpecificSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, a, "kitchen", []string{})
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetPreference(t, c, chore, "dislike")
		apitest.ExpectStatus(t, c.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)
	}
	const prefs = `SELECT count(*) FROM resident_chore_preferences`
	const restr = `SELECT count(*) FROM resident_chore_restrictions`
	if p, r := apitest.Count(t, app, prefs), apitest.Count(t, app, restr); p != 2 || r != 2 {
		t.Fatalf("before leaving: preferences = %d, restrictions = %d, want 2 and 2", p, r)
	}

	apitest.ExpectStatus(t, apitest.LeaveHome(b), http.StatusNoContent)
	if p, r := apitest.Count(t, app, prefs), apitest.Count(t, app, restr); p != 1 || r != 1 {
		t.Errorf("after leaving: preferences = %d, restrictions = %d, want only the other Resident's 1 and 1", p, r)
	}
	mine := a.Get("/home/chores/settings").Body["residents"].([]any)
	if len(mine) != 1 || mine[0].(map[string]any)["chores"].(map[string]any)[chore].(map[string]any)["preference"] != "dislike" {
		t.Errorf("remaining Resident's settings = %v, want unchanged", mine)
	}
}

func TestLeavingKeepsTheUsersGeneralProfile(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, b, map[string]any{"monday": 7})
	apitest.ExpectStatus(t, b.Put("/me/preferences/kitchen", map[string]any{"preference": "like"}), http.StatusNoContent)
	apitest.ExpectStatus(t, b.Put("/me/restrictions/heights", nil), http.StatusNoContent)

	apitest.ExpectStatus(t, apitest.LeaveHome(b), http.StatusNoContent)
	res := b.Get("/me/profile")
	apitest.ExpectStatus(t, res, http.StatusOK)
	if bl := apitest.BaselineOf(t, res); bl["monday"] != float64(7) {
		t.Errorf("baseline = %v, want monday 7", bl)
	}
	if res.Body["preferences"].(map[string]any)["kitchen"] != "like" {
		t.Errorf("preferences = %v, want kitchen like", res.Body["preferences"])
	}
	if got := fmt.Sprint(res.Body["restrictions"]); !strings.Contains(got, "heights") {
		t.Errorf("restrictions = %v, want heights", res.Body["restrictions"])
	}
}

func TestTheLastResidentLeavingDeletesTheHomeAndEverythingInIt(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.SetBaseline(t, a, map[string]any{"monday": 5})
	apitest.AtDay(app, 2)
	apitest.CreateChore(t, a, apitest.Chore("Dishes", 7, 3, "essential", []string{}))
	apitest.CreateInvite(t, a) // left unused
	app.RunAllocation(t)
	if n := apitest.Count(t, app, `SELECT count(*) FROM day_plan_assignments`); n != 1 {
		t.Fatalf("assignments before leaving = %d, want 1", n)
	}

	apitest.ExpectStatus(t, apitest.LeaveHome(a), http.StatusNoContent)
	for _, table := range []string{"homes", "residents", "chores", "tasks", "invites", "allocation_runs", "day_plan_assignments"} {
		if n := apitest.Count(t, app, `SELECT count(*) FROM `+table); n != 0 {
			t.Errorf("%s rows = %d, want 0", table, n)
		}
	}
	apitest.ExpectStatus(t, a.Get("/home"), http.StatusNotFound)
}

func TestLeavingNeedsAHomeAndAToken(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	res := apitest.LeaveHome(app.SignInAs("a@example.com"))
	if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
		t.Errorf("leaving without a Home = %d %s, want 404 no home", res.Status, res.Raw)
	}
	b := apitest.HomeWithResident(t, app, "b@example.com")
	apitest.ExpectStatus(t, app.Do(http.MethodDelete, "/home/residents/me", nil), http.StatusUnauthorized)
	apitest.ExpectStatus(t, b.Get("/home"), http.StatusOK)
}

func TestAfterLeavingTheSameUserCanCreateAHomeOrAcceptAnInvite(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")

	apitest.ExpectStatus(t, apitest.LeaveHome(b), http.StatusNoContent)
	apitest.ExpectStatus(t, b.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	if b.Get("/home").Body["id"] == a.Get("/home").Body["id"] {
		t.Errorf("b got the old Home back, want a new one")
	}

	apitest.ExpectStatus(t, apitest.LeaveHome(b), http.StatusNoContent)
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, apitest.CreateInvite(t, a), nil), http.StatusOK)
	if b.Get("/home").Body["id"] != a.Get("/home").Body["id"] {
		t.Errorf("b did not rejoin a's Home")
	}
}

func TestTwoResidentsLeavingAtOnceDeleteTheHomeOnce(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.ChoreIn(t, a, "kitchen", []string{})
	b := apitest.ExtraResident(t, app, a, "b@example.com")

	statuses := make([]int, 2)
	var wg sync.WaitGroup
	for i, c := range []*apitest.Client{a, b} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = apitest.LeaveHome(c).Status
		}()
	}
	wg.Wait()

	if statuses[0] != http.StatusNoContent || statuses[1] != http.StatusNoContent {
		t.Fatalf("statuses = %v, want 204 and 204", statuses)
	}
	if n := apitest.Count(t, app, `SELECT (SELECT count(*) FROM homes) + (SELECT count(*) FROM residents) + (SELECT count(*) FROM chores)`); n != 0 {
		t.Errorf("rows left = %d, want the Home, its Residents and Chores gone", n)
	}
}
