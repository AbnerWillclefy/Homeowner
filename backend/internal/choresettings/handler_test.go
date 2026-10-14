package choresettings_test

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// effective is one Resident's effective settings on one Chore, as the API
// returns them.
type effective struct {
	Preference        string
	Source            string
	Restricted        bool
	RestrictedBy      []any
	RestrictedByChore bool
}

// settingWrites is every write route under /home/chores/{id}, with a valid
// body, shared by the tests that probe how they fail.
var settingWrites = []struct {
	method, suffix string
	body           any
}{
	{http.MethodPut, "/preference", map[string]any{"preference": "like"}},
	{http.MethodDelete, "/preference", nil},
	{http.MethodPut, "/restriction", nil},
	{http.MethodDelete, "/restriction", nil},
}

// missingChoreID is a well-formed id that names no Chore.
const missingChoreID = "00000000-0000-4000-8000-000000000000"

func toEffective(t *testing.T, v any) effective {
	t.Helper()
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("no effective entry: %#v", v)
	}
	by, _ := m["restrictedBy"].([]any)
	if by == nil {
		by = []any{}
	}
	return effective{
		Preference:        m["preference"].(string),
		Source:            m["source"].(string),
		Restricted:        m["restricted"].(bool),
		RestrictedBy:      by,
		RestrictedByChore: m["restrictedByChore"].(bool),
	}
}

// settingsView fetches GET /home/chores/settings.
func settingsView(t *testing.T, c *apitest.Client) []any {
	t.Helper()
	r := c.Get("/home/chores/settings")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/chores/settings = %d %s", r.Status, r.Raw)
	}
	l, ok := r.Body["residents"].([]any)
	if !ok {
		t.Fatalf("no residents array: %s", r.Raw)
	}
	return l
}

// myView is the caller's own entry ("you": true) in the settings view.
func myView(t *testing.T, c *apitest.Client) map[string]any {
	t.Helper()
	for _, r := range settingsView(t, c) {
		m := r.(map[string]any)
		if m["you"] == true {
			return m
		}
	}
	t.Fatal("no resident marked you")
	return nil
}

// mine is the caller's effective settings on a Chore.
func mine(t *testing.T, c *apitest.Client, choreID string) effective {
	t.Helper()
	chores := myView(t, c)["chores"].(map[string]any)
	return toEffective(t, chores[choreID])
}

func TestASpecificDislikeShowsAsTheEffectivePreference(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	dishes := apitest.ChoreIn(t, me, "kitchen", []string{})

	if got := mine(t, me, dishes); got.Preference != "neutral" || got.Source != "default" {
		t.Fatalf("before = %+v, want neutral/default", got)
	}
	apitest.SetPreference(t, me, dishes, "dislike")
	if got := mine(t, me, dishes); got.Preference != "dislike" || got.Source != "specific" {
		t.Fatalf("after = %+v, want dislike/specific", got)
	}
}

func TestSpecificBeatsGeneralAndClearingFallsBack(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	dishes := apitest.ChoreIn(t, me, "kitchen", []string{})
	oven := apitest.ChoreIn(t, me, "kitchen", []string{})
	apitest.ExpectStatus(t, me.Put("/me/preferences/kitchen", map[string]any{"preference": "dislike"}), http.StatusNoContent)

	apitest.SetPreference(t, me, dishes, "neutral")
	if got := mine(t, me, dishes); got.Preference != "neutral" || got.Source != "specific" {
		t.Errorf("specific neutral = %+v, want neutral/specific", got)
	}
	if got := mine(t, me, oven); got.Preference != "dislike" || got.Source != "general" {
		t.Errorf("other chore of the category = %+v, want dislike/general", got)
	}

	apitest.ExpectStatus(t, me.Delete("/home/chores/"+dishes+"/preference"), http.StatusNoContent)
	if got := mine(t, me, dishes); got.Preference != "dislike" || got.Source != "general" {
		t.Errorf("after clear = %+v, want dislike/general", got)
	}

	apitest.SetPreference(t, me, dishes, "like")
	if got := mine(t, me, dishes); got.Preference != "like" || got.Source != "specific" {
		t.Errorf("specific like over general dislike = %+v", got)
	}
}

func TestRestrictionsGeneralSpecificAndNeither(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	heavy := apitest.ChoreIn(t, me, "outdoor", []string{"heavy_lifting"})
	bare := apitest.ChoreIn(t, me, "kitchen", []string{})
	other := apitest.ChoreIn(t, me, "floors", []string{"bending"})
	apitest.ExpectStatus(t, me.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)

	if got := mine(t, me, heavy); !got.Restricted || !reflect.DeepEqual(got.RestrictedBy, []any{"heavy_lifting"}) || got.RestrictedByChore {
		t.Errorf("general demand restriction = %+v", got)
	}
	if got := mine(t, me, other); got.Restricted {
		t.Errorf("chore matching neither = %+v, want not restricted", got)
	}

	apitest.ExpectStatus(t, me.Put("/home/chores/"+bare+"/restriction", nil), http.StatusNoContent)
	if got := mine(t, me, bare); !got.Restricted || len(got.RestrictedBy) != 0 || !got.RestrictedByChore {
		t.Errorf("specific restriction = %+v", got)
	}

	// A specific Restriction on the heavy Chore adds a reason; removing it
	// leaves the general one in force.
	apitest.ExpectStatus(t, me.Put("/home/chores/"+heavy+"/restriction", nil), http.StatusNoContent)
	if got := mine(t, me, heavy); !got.Restricted || !got.RestrictedByChore || len(got.RestrictedBy) != 1 {
		t.Errorf("both reasons = %+v", got)
	}
	apitest.ExpectStatus(t, me.Delete("/home/chores/"+heavy+"/restriction"), http.StatusNoContent)
	if got := mine(t, me, heavy); !got.Restricted || got.RestrictedByChore || len(got.RestrictedBy) != 1 {
		t.Errorf("after removing the specific one = %+v, want the general one still in force", got)
	}
}

func TestResidentsOfAHomeHaveTheirOwnSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"].(string)
	b := app.SignInAs("b@example.com")
	b.JoinHome(t, homeID)
	dishes := apitest.ChoreIn(t, a, "kitchen", []string{})

	apitest.SetPreference(t, a, dishes, "dislike")
	apitest.ExpectStatus(t, a.Put("/home/chores/"+dishes+"/restriction", nil), http.StatusNoContent)

	if got := mine(t, b, dishes); got.Preference != "neutral" || got.Source != "default" || got.Restricted {
		t.Errorf("b's own view = %+v, want untouched", got)
	}
	// Both see both Residents, each marked "you" only for themselves, and
	// A's entry shows A's setting.
	for _, c := range []*apitest.Client{a, b} {
		view := settingsView(t, c)
		if len(view) != 2 {
			t.Fatalf("residents = %d, want 2", len(view))
		}
		youCount := 0
		var aEntry effective
		for _, r := range view {
			m := r.(map[string]any)
			if m["you"] == true {
				youCount++
			}
			if e := toEffective(t, m["chores"].(map[string]any)[dishes]); e.Preference == "dislike" {
				aEntry = e
			}
		}
		if youCount != 1 || aEntry.Source != "specific" || !aEntry.RestrictedByChore {
			t.Errorf("view = %v", view)
		}
	}
}

func TestSettingsAreNeverVisibleOrWritableAcrossHomes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.HomeWithResident(t, app, "b@example.com")
	aChore := apitest.ChoreIn(t, a, "kitchen", []string{})
	bChore := apitest.ChoreIn(t, b, "kitchen", []string{})
	apitest.SetPreference(t, a, aChore, "dislike")

	for _, w := range settingWrites {
		foreignPath := "/home/chores/" + aChore + w.suffix
		foreign := b.Do(w.method, foreignPath, w.body, nil)
		missing := b.Do(w.method, "/home/chores/"+missingChoreID+w.suffix, w.body, nil)
		if foreign.Status != http.StatusNotFound || missing.Status != http.StatusNotFound || string(foreign.Raw) != string(missing.Raw) {
			t.Errorf("%s %s: foreign = %d %s, missing = %d %s, want identical 404s",
				w.method, foreignPath, foreign.Status, foreign.Raw, missing.Status, missing.Raw)
		}
	}

	// Nothing was stored for B, and A's own setting is untouched.
	var n int
	if err := app.DB.QueryRow(context.Background(),
		`SELECT (SELECT count(*) FROM resident_chore_preferences) + (SELECT count(*) FROM resident_chore_restrictions)`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("stored rows = %d, want only A's one preference", n)
	}
	if got := mine(t, a, aChore); got.Preference != "dislike" || got.RestrictedByChore {
		t.Errorf("A's view = %+v", got)
	}

	// B's view holds only B's Resident and B's Chore.
	view := settingsView(t, b)
	if len(view) != 1 {
		t.Fatalf("B sees %d residents, want 1", len(view))
	}
	chores := view[0].(map[string]any)["chores"].(map[string]any)
	if len(chores) != 1 || chores[bChore] == nil {
		t.Errorf("B's chores = %v, want only %s", chores, bChore)
	}
	if got := mine(t, b, bChore); got.Preference != "neutral" {
		t.Errorf("B's chore = %+v, want neutral", got)
	}
}

func TestLeavingAHomeDropsTheResidentsSpecificSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, a, "kitchen", []string{})
	apitest.SetPreference(t, a, chore, "dislike")
	apitest.ExpectStatus(t, a.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)

	// The leave flow does not exist yet; deleting the residents row is what it
	// must do, and the cascade then clears the settings.
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM residents`); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := app.DB.QueryRow(context.Background(),
		`SELECT (SELECT count(*) FROM resident_chore_preferences) + (SELECT count(*) FROM resident_chore_restrictions)`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("rows left after the Resident left = %d, want 0", n)
	}

	// Joining another Home starts clean.
	other := apitest.HomeWithResident(t, app, "b@example.com")
	otherHome := other.Get("/home").Body["id"].(string)
	a.JoinHome(t, otherHome)
	otherChore := apitest.ChoreIn(t, other, "kitchen", []string{})
	if got := mine(t, a, otherChore); got.Preference != "neutral" || got.Restricted {
		t.Errorf("after joining another Home = %+v, want clean", got)
	}
}

func TestChoreSettingsWritesAreIdempotent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, me, "kitchen", []string{})
	p := "/home/chores/" + chore + "/preference"
	r := "/home/chores/" + chore + "/restriction"

	for range 2 {
		apitest.ExpectStatus(t, me.Delete(p), http.StatusNoContent) // never set
		apitest.ExpectStatus(t, me.Delete(r), http.StatusNoContent)
	}
	for range 2 {
		apitest.ExpectStatus(t, me.Put(p, map[string]any{"preference": "like"}), http.StatusNoContent)
		apitest.ExpectStatus(t, me.Put(r, nil), http.StatusNoContent)
	}
	if got := mine(t, me, chore); got.Preference != "like" || !got.RestrictedByChore {
		t.Errorf("after setting twice = %+v", got)
	}
	for range 2 {
		apitest.ExpectStatus(t, me.Delete(p), http.StatusNoContent)
		apitest.ExpectStatus(t, me.Delete(r), http.StatusNoContent)
	}
	if got := mine(t, me, chore); got.Preference != "neutral" || got.Restricted {
		t.Errorf("after clearing twice = %+v", got)
	}
}

func TestChoreSettingsErrors(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, me, "kitchen", []string{})
	p := "/home/chores/" + chore + "/preference"

	for name, body := range map[string]any{
		"bad value":     map[string]any{"preference": "love"},
		"empty value":   map[string]any{"preference": ""},
		"unknown field": map[string]any{"preference": "like", "extra": 1},
	} {
		if r := me.Put(p, body); r.Status != http.StatusBadRequest {
			t.Errorf("%s: PUT = %d %s, want 400", name, r.Status, r.Raw)
		}
	}
	if r := me.SendRaw(http.MethodPut, p, []byte("{")); r.Status != http.StatusBadRequest {
		t.Errorf("malformed JSON = %d, want 400", r.Status)
	}
	if got := mine(t, me, chore); got.Source != "default" {
		t.Errorf("a rejected write stored something: %+v", got)
	}

	for _, w := range settingWrites {
		path := "/home/chores/not-a-uuid" + w.suffix
		if r := me.Do(w.method, path, w.body, nil); r.Status != http.StatusNotFound {
			t.Errorf("%s %s = %d, want 404", w.method, path, r.Status)
		}
	}

	for _, rt := range []struct{ method, path string }{
		{http.MethodGet, "/home/chores/settings"},
		{http.MethodPut, p},
		{http.MethodDelete, p},
		{http.MethodPut, "/home/chores/" + chore + "/restriction"},
		{http.MethodDelete, "/home/chores/" + chore + "/restriction"},
	} {
		if r := app.SendRaw(rt.method, rt.path, nil); r.Status != http.StatusUnauthorized {
			t.Errorf("%s %s without a token = %d, want 401", rt.method, rt.path, r.Status)
		}
		nohome := app.SignInAs("nohome@example.com")
		if r := nohome.Do(rt.method, rt.path, nil, nil); r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
			t.Errorf("%s %s with no Home = %d %s, want 404 no home", rt.method, rt.path, r.Status, r.Raw)
		}
	}
}

func TestEmptyHomeViewHasEmptyMapsNotNull(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	r := me.Get("/home/chores/settings")
	apitest.ExpectStatus(t, r, http.StatusOK)
	residents := r.Body["residents"].([]any)
	if len(residents) != 1 {
		t.Fatalf("residents = %s", r.Raw)
	}
	m := residents[0].(map[string]any)
	if chores, ok := m["chores"].(map[string]any); !ok || len(chores) != 0 {
		t.Errorf("chores = %#v, want {}", m["chores"])
	}
	if m["id"] == "" || m["you"] != true {
		t.Errorf("resident = %v", m)
	}
}

func TestDeletingAChoreRemovesItsSpecificSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, me, "kitchen", []string{})
	apitest.SetPreference(t, me, chore, "dislike")
	apitest.ExpectStatus(t, me.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)

	apitest.ExpectStatus(t, me.Delete("/home/chores/"+chore), http.StatusNoContent)
	if _, present := myView(t, me)["chores"].(map[string]any)[chore]; present {
		t.Error("deleted Chore is still in the view")
	}
	var n int
	if err := app.DB.QueryRow(context.Background(),
		`SELECT (SELECT count(*) FROM resident_chore_preferences) + (SELECT count(*) FROM resident_chore_restrictions)`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("rows left = %d, want 0", n)
	}
}

func TestUpdatingAChoreChangesTheEffectiveResultAndKeepsSpecificSettings(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	chore := apitest.ChoreIn(t, me, "kitchen", []string{})
	apitest.ExpectStatus(t, me.Put("/me/preferences/outdoor", map[string]any{"preference": "like"}), http.StatusNoContent)
	apitest.ExpectStatus(t, me.Put("/me/restrictions/heights", nil), http.StatusNoContent)
	apitest.SetPreference(t, me, chore, "dislike")
	apitest.ExpectStatus(t, me.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)

	upd := apitest.WithField(apitest.WithField(apitest.ValidChore(), "category", "outdoor"), "demands", []string{"heights"})
	apitest.ExpectStatus(t, me.Put("/home/chores/"+chore, upd), http.StatusOK)

	got := mine(t, me, chore)
	if got.Preference != "dislike" || got.Source != "specific" || !got.RestrictedByChore {
		t.Errorf("specific rows after update = %+v, want them kept", got)
	}
	if !reflect.DeepEqual(got.RestrictedBy, []any{"heights"}) {
		t.Errorf("restrictedBy = %v, want the new Demand", got.RestrictedBy)
	}

	// With the specific Preference cleared, the new Category's general one applies.
	apitest.ExpectStatus(t, me.Delete("/home/chores/"+chore+"/preference"), http.StatusNoContent)
	if got := mine(t, me, chore); got.Preference != "like" || got.Source != "general" {
		t.Errorf("after clear = %+v, want like/general from the new Category", got)
	}
}
