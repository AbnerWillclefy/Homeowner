package server_test

import (
	"context"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func countChores(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM chores").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// validChore is a recurring Chore every field of which is acceptable.
func validChore() map[string]any {
	return map[string]any{
		"name": "Mop floors", "category": "floors", "demands": []string{"bending"},
		"baseEffort": 3, "importance": "normal", "people": 1,
		"intervalDays": 7, "allowedWeekdays": []int{}, "buildsUp": true,
	}
}

// with returns a copy of base with key k set to v (nil means JSON null).
func with(base map[string]any, k string, v any) map[string]any {
	out := map[string]any{}
	for kk, vv := range base {
		out[kk] = vv
	}
	out[k] = v
	return out
}

func homeWithResident(t *testing.T, app *apitest.App, email string) *apitest.Client {
	t.Helper()
	c := app.SignInAs(email)
	if r := c.Post("/home", homeBody("UTC", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	return c
}

func listChores(t *testing.T, c *apitest.Client) []any {
	t.Helper()
	r := c.Get("/home/chores")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/chores = %d %s", r.Status, r.Raw)
	}
	l, ok := r.Body["chores"].([]any)
	if !ok {
		t.Fatalf("no chores array: %s", r.Raw)
	}
	return l
}

func TestChoresRoundTripEveryField(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")

	oneOff := map[string]any{
		"name": "Clean gutters", "category": "outdoor", "demands": []string{"heights", "heavy_lifting"},
		"baseEffort": 5, "importance": "nice_to_have", "people": 2,
		"intervalDays": nil, "allowedWeekdays": []int{6}, "buildsUp": false,
	}
	a := me.Post("/home/chores", oneOff)
	if a.Status != http.StatusCreated {
		t.Fatalf("POST = %d %s, want 201", a.Status, a.Raw)
	}
	if a.Body["id"] == nil || a.Body["name"] != "Clean gutters" || a.Body["category"] != "outdoor" ||
		a.Body["baseEffort"] != float64(5) || a.Body["importance"] != "nice_to_have" ||
		a.Body["people"] != float64(2) || a.Body["buildsUp"] != false ||
		!reflect.DeepEqual(a.Body["demands"], []any{"heavy_lifting", "heights"}) ||
		!reflect.DeepEqual(a.Body["allowedWeekdays"], []any{float64(6)}) {
		t.Fatalf("created one-off = %s", a.Raw)
	}
	if v, present := a.Body["intervalDays"]; !present || v != nil {
		t.Errorf("one-off intervalDays = %#v present=%v, want explicit null", v, present)
	}

	app.Clock.Advance(time.Minute) // the frozen clock would tie created_at and leave order to the random id
	b := me.Post("/home/chores", validChore())
	if b.Status != http.StatusCreated || b.Body["intervalDays"] != float64(7) || b.Body["buildsUp"] != true ||
		!reflect.DeepEqual(b.Body["allowedWeekdays"], []any{}) {
		t.Fatalf("recurring create = %d %s", b.Status, b.Raw)
	}

	l := listChores(t, me)
	if len(l) != 2 || l[0].(map[string]any)["id"] != a.Body["id"] || l[1].(map[string]any)["id"] != b.Body["id"] {
		t.Fatalf("list = %v, want both in creation order", l)
	}

	upd := map[string]any{
		"name": "Wipe counters", "category": "kitchen", "demands": []string{},
		"baseEffort": 1, "importance": "essential", "people": 1,
		"intervalDays": 2, "allowedWeekdays": []int{1, 3}, "buildsUp": false,
	}
	id := a.Body["id"].(string)
	u := me.Put("/home/chores/"+id, upd)
	if u.Status != http.StatusOK {
		t.Fatalf("PUT = %d %s", u.Status, u.Raw)
	}
	if u.Body["id"] != id || u.Body["name"] != "Wipe counters" || u.Body["category"] != "kitchen" ||
		u.Body["baseEffort"] != float64(1) || u.Body["importance"] != "essential" ||
		u.Body["people"] != float64(1) || u.Body["intervalDays"] != float64(2) ||
		u.Body["buildsUp"] != false || !reflect.DeepEqual(u.Body["allowedWeekdays"], []any{float64(1), float64(3)}) ||
		!reflect.DeepEqual(u.Body["demands"], []any{}) {
		t.Fatalf("PUT did not replace every field: %s", u.Raw)
	}
	got := listChores(t, me)[0].(map[string]any)
	if got["name"] != "Wipe counters" || got["intervalDays"] != float64(2) {
		t.Fatalf("list after PUT = %v", got)
	}

	if d := me.Delete("/home/chores/" + id); d.Status != http.StatusNoContent {
		t.Fatalf("DELETE = %d %s, want 204", d.Status, d.Raw)
	}
	if l := listChores(t, me); len(l) != 1 {
		t.Fatalf("list after delete = %v, want 1", l)
	}
	if r := me.Put("/home/chores/"+id, upd); r.Status != http.StatusNotFound {
		t.Fatalf("PUT deleted = %d, want 404", r.Status)
	}
	if r := me.Delete("/home/chores/" + id); r.Status != http.StatusNotFound {
		t.Fatalf("DELETE deleted = %d, want 404", r.Status)
	}
}

func TestInvalidChoresAreRejectedWithAFieldCodeAndNothingIsStored(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")

	cases := []struct {
		name, field, code string
		body              map[string]any
	}{
		{"empty name", "name", "required", with(validChore(), "name", "")},
		{"whitespace name", "name", "required", with(validChore(), "name", "   \t")},
		{"101-char name", "name", "too_long", with(validChore(), "name", strings.Repeat("é", 101))},
		{"effort 0", "baseEffort", "out_of_range", with(validChore(), "baseEffort", 0)},
		{"effort 6", "baseEffort", "out_of_range", with(validChore(), "baseEffort", 6)},
		{"effort 2.5", "baseEffort", "invalid", with(validChore(), "baseEffort", 2.5)},
		{"effort string", "baseEffort", "invalid", with(validChore(), "baseEffort", "3")},
		{"effort missing", "baseEffort", "required", with(validChore(), "baseEffort", nil)},
		{"people 0", "people", "out_of_range", with(validChore(), "people", 0)},
		{"people 3", "people", "out_of_range", with(validChore(), "people", 3)},
		{"interval 0", "intervalDays", "out_of_range", with(validChore(), "intervalDays", 0)},
		{"interval -1", "intervalDays", "out_of_range", with(validChore(), "intervalDays", -1)},
		{"interval 366", "intervalDays", "out_of_range", with(validChore(), "intervalDays", 366)},
		{"weekday 7", "allowedWeekdays", "out_of_range", with(validChore(), "allowedWeekdays", []int{1, 7})},
		{"weekday -1", "allowedWeekdays", "out_of_range", with(validChore(), "allowedWeekdays", []int{-1})},
		{"unknown category", "category", "unknown", with(validChore(), "category", "garage")},
		{"unknown importance", "importance", "unknown", with(validChore(), "importance", "urgent")},
		{"unknown demand", "demands", "unknown", with(validChore(), "demands", []string{"bending", "flying"})},
	}
	for _, tc := range cases {
		r := me.Post("/home/chores", tc.body)
		fields, _ := r.Body["fields"].(map[string]any)
		if r.Status != http.StatusBadRequest || r.Body["error"] != "invalid chore" || fields[tc.field] != tc.code {
			t.Errorf("%s: POST = %d %s, want 400 with %s=%s", tc.name, r.Status, r.Raw, tc.field, tc.code)
		}
	}

	// All field errors come at once.
	r := me.Post("/home/chores", with(with(validChore(), "name", ""), "baseEffort", 9))
	if f, _ := r.Body["fields"].(map[string]any); len(f) != 2 {
		t.Errorf("fields = %s, want two codes at once", r.Raw)
	}

	for name, raw := range map[string]string{
		"unknown field": `{"name":"x","baseEffrot":3}`,
		"malformed":     `{"name":`,
	} {
		if r := me.SendRaw(http.MethodPost, "/home/chores", []byte(raw)); r.Status != http.StatusBadRequest {
			t.Errorf("%s: = %d, want 400", name, r.Status)
		}
	}
	big := `{"name":"` + strings.Repeat("a", 20*1024) + `"}`
	if r := me.SendRaw(http.MethodPost, "/home/chores", []byte(big)); r.Status != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized = %d, want 413", r.Status)
	}

	// A rejected update changes nothing.
	ok := me.Post("/home/chores", validChore())
	id := ok.Body["id"].(string)
	if r := me.Put("/home/chores/"+id, with(validChore(), "baseEffort", 0)); r.Status != http.StatusBadRequest {
		t.Errorf("PUT invalid = %d, want 400", r.Status)
	}
	if n := countChores(t, app); n != 1 {
		t.Fatalf("chores stored = %d, want only the one valid Chore", n)
	}
	if l := listChores(t, me)[0].(map[string]any); l["baseEffort"] != float64(3) {
		t.Fatalf("rejected PUT changed the Chore: %v", l)
	}
}

func TestChoresAreNormalised(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	body := with(with(with(validChore(), "name", "  Mop  "), "demands", []string{"heights", "bending", "heights"}),
		"allowedWeekdays", []int{5, 0, 5, 3})
	r := me.Post("/home/chores", body)
	if r.Status != http.StatusCreated || r.Body["name"] != "Mop" ||
		!reflect.DeepEqual(r.Body["demands"], []any{"bending", "heights"}) ||
		!reflect.DeepEqual(r.Body["allowedWeekdays"], []any{float64(0), float64(3), float64(5)}) {
		t.Fatalf("POST = %d %s, want trimmed name, sorted de-duplicated lists", r.Status, r.Raw)
	}
}

func TestChoresAreIsolatedBetweenHomes(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	b := homeWithResident(t, app, "b@example.com")
	c := a.Post("/home/chores", validChore())
	id := c.Body["id"].(string)

	if r := b.Put("/home/chores/"+id, with(validChore(), "name", "Hijacked")); r.Status != http.StatusNotFound {
		t.Errorf("other Home PUT = %d, want 404", r.Status)
	}
	if r := b.Delete("/home/chores/" + id); r.Status != http.StatusNotFound {
		t.Errorf("other Home DELETE = %d, want 404", r.Status)
	}
	if l := listChores(t, b); len(l) != 0 {
		t.Errorf("other Home list = %v, want empty", l)
	}
	if l := listChores(t, a); len(l) != 1 || l[0].(map[string]any)["name"] != "Mop floors" {
		t.Errorf("owner list = %v, want unchanged", l)
	}
	if r := a.Put("/home/chores/not-a-uuid", validChore()); r.Status != http.StatusNotFound {
		t.Errorf("malformed id = %d, want 404", r.Status)
	}
	if r := a.Delete("/home/chores/not-a-uuid"); r.Status != http.StatusNotFound {
		t.Errorf("malformed id DELETE = %d, want 404", r.Status)
	}
}

func TestAnyResidentManagesTheHomesChores(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	home := a.Get("/home").Body["id"].(string)
	b := app.SignInAs("b@example.com")
	b.JoinHome(t, home)

	made := b.Post("/home/chores", validChore())
	if made.Status != http.StatusCreated {
		t.Fatalf("second Resident POST = %d %s", made.Status, made.Raw)
	}
	id := made.Body["id"].(string)
	if l := listChores(t, a); len(l) != 1 {
		t.Fatalf("first Resident sees %v, want the Chore", l)
	}
	if r := a.Put("/home/chores/"+id, with(validChore(), "name", "Renamed")); r.Status != http.StatusOK {
		t.Fatalf("first Resident PUT = %d %s", r.Status, r.Raw)
	}
	if r := b.Delete("/home/chores/" + id); r.Status != http.StatusNoContent {
		t.Fatalf("second Resident DELETE = %d", r.Status)
	}
}

func TestChoreRoutesNeedAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Get("/home/chores"); r.Status != http.StatusNotFound {
		t.Errorf("GET = %d, want 404", r.Status)
	}
	if r := me.Post("/home/chores", validChore()); r.Status != http.StatusNotFound {
		t.Errorf("POST = %d, want 404", r.Status)
	}
	if r := app.Get("/home/chores"); r.Status != http.StatusUnauthorized {
		t.Errorf("anonymous GET = %d, want 401", r.Status)
	}
}
