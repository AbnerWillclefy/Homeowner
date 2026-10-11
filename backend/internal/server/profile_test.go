package server_test

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

var weekdays = []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}

// baselineOf returns the profile's baseline as weekday name to value (nil for
// null), failing if any of the seven keys is missing.
func baselineOf(t *testing.T, res apitest.Response) map[string]any {
	t.Helper()
	if res.Status != http.StatusOK {
		t.Fatalf("got %d %s, want 200", res.Status, res.Raw)
	}
	b, ok := res.Body["baseline"].(map[string]any)
	if !ok || len(b) != 7 {
		t.Fatalf("baseline = %v, want an object with all seven weekdays", res.Body["baseline"])
	}
	for _, d := range weekdays {
		if _, ok := b[d]; !ok {
			t.Fatalf("baseline has no %q key: %v", d, b)
		}
	}
	return b
}

func TestAFreshUsersProfileIsEmpty(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	res := app.SignInAs("a@example.com").Get("/me/profile")

	for day, v := range baselineOf(t, res) {
		if v != nil {
			t.Errorf("baseline[%s] = %v, want null", day, v)
		}
	}
	if prefs, ok := res.Body["preferences"].(map[string]any); !ok || len(prefs) != 0 {
		t.Errorf("preferences = %v, want {}", res.Body["preferences"])
	}
	if rs, ok := res.Body["restrictions"].([]any); !ok || len(rs) != 0 {
		t.Errorf("restrictions = %v, want []", res.Body["restrictions"])
	}
}

func TestCategoriesAndDemandsAreTheFixedOrderedLists(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	wantCategories := []any{"kitchen", "bathroom", "bedroom", "living_room", "laundry", "floors", "trash", "outdoor", "pets", "other"}
	wantDemands := []any{"heavy_lifting", "bending", "heights", "strong_chemicals"}
	for path, want := range map[string]struct {
		key  string
		list []any
	}{
		"/categories": {"categories", wantCategories},
		"/demands":    {"demands", wantDemands},
	} {
		res := me.Get(path)
		if res.Status != http.StatusOK || !reflect.DeepEqual(res.Body[want.key], want.list) {
			t.Errorf("GET %s = %d %s, want %v", path, res.Status, res.Raw, want.list)
		}
		if anon := app.Get(path); anon.Status != http.StatusUnauthorized {
			t.Errorf("GET %s without a token = %d, want 401", path, anon.Status)
		}
	}
}

func TestBaselineIsSetAndClearedPerDayLeavingOtherDaysAlone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	if res := me.Put("/me/baseline", map[string]any{"monday": 5, "tuesday": 0}); res.Status != http.StatusNoContent {
		t.Fatalf("first PUT = %d %s, want 204", res.Status, res.Raw)
	}
	got := baselineOf(t, me.Get("/me/profile"))
	for _, d := range weekdays {
		var want any
		switch d {
		case "monday":
			want = float64(5)
		case "tuesday":
			want = float64(0) // 0 is a real value, not unset
		}
		if got[d] != want {
			t.Errorf("baseline[%s] = %v, want %v", d, got[d], want)
		}
	}

	if res := me.Put("/me/baseline", map[string]any{"monday": nil, "friday": 20}); res.Status != http.StatusNoContent {
		t.Fatalf("second PUT = %d %s, want 204", res.Status, res.Raw)
	}
	got = baselineOf(t, me.Get("/me/profile"))
	if got["monday"] != nil || got["tuesday"] != float64(0) || got["friday"] != float64(20) {
		t.Errorf("baseline = %v, want monday cleared, tuesday 0, friday 20", got)
	}

	// Clearing a day that was never set is not an error.
	if res := me.Put("/me/baseline", map[string]any{"sunday": nil}); res.Status != http.StatusNoContent {
		t.Errorf("clearing an unset day = %d %s, want 204", res.Status, res.Raw)
	}
}

func preferencesOf(t *testing.T, me *apitest.Client) map[string]any {
	t.Helper()
	res := me.Get("/me/profile")
	prefs, ok := res.Body["preferences"].(map[string]any)
	if !ok {
		t.Fatalf("preferences in %s, want an object", res.Raw)
	}
	return prefs
}

func countRows(t *testing.T, app *apitest.App, table string) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM "+table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPreferenceNeutralRemovesItAndAnUnsetCategoryIsAbsent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	if res := me.Put("/me/preferences/kitchen", map[string]any{"preference": "dislike"}); res.Status != http.StatusNoContent {
		t.Fatalf("PUT dislike = %d %s, want 204", res.Status, res.Raw)
	}
	// A later value replaces the earlier one.
	me.Put("/me/preferences/kitchen", map[string]any{"preference": "like"})
	me.Put("/me/preferences/trash", map[string]any{"preference": "dislike"})
	if got := preferencesOf(t, me); !reflect.DeepEqual(got, map[string]any{"kitchen": "like", "trash": "dislike"}) {
		t.Fatalf("preferences = %v, want kitchen like and trash dislike", got)
	}

	if res := me.Put("/me/preferences/kitchen", map[string]any{"preference": "neutral"}); res.Status != http.StatusNoContent {
		t.Fatalf("PUT neutral = %d %s, want 204", res.Status, res.Raw)
	}
	if got := preferencesOf(t, me); !reflect.DeepEqual(got, map[string]any{"trash": "dislike"}) {
		t.Errorf("preferences = %v, want only trash", got)
	}
	if n := countRows(t, app, "user_category_preferences"); n != 1 {
		t.Errorf("rows = %d, want 1: neutral must delete the row", n)
	}
	// Neutral on a never-set Category is fine too.
	if res := me.Put("/me/preferences/pets", map[string]any{"preference": "neutral"}); res.Status != http.StatusNoContent {
		t.Errorf("neutral on unset = %d %s, want 204", res.Status, res.Raw)
	}
}

func restrictionsOf(t *testing.T, me *apitest.Client) []any {
	t.Helper()
	res := me.Get("/me/profile")
	rs, ok := res.Body["restrictions"].([]any)
	if !ok {
		t.Fatalf("restrictions in %s, want an array", res.Raw)
	}
	return rs
}

func TestRestrictionsAreAddedAndRemovedIdempotently(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for range 2 {
		if res := me.Put("/me/restrictions/heavy_lifting", nil); res.Status != http.StatusNoContent {
			t.Fatalf("PUT = %d %s, want 204", res.Status, res.Raw)
		}
	}
	me.Put("/me/restrictions/bending", nil)
	if got := restrictionsOf(t, me); !reflect.DeepEqual(got, []any{"heavy_lifting", "bending"}) {
		t.Fatalf("restrictions = %v, want heavy_lifting and bending once each, in GET /demands order", got)
	}
	if n := countRows(t, app, "user_demand_restrictions"); n != 2 {
		t.Errorf("rows = %d, want 2", n)
	}

	for range 2 {
		if res := me.Delete("/me/restrictions/heavy_lifting"); res.Status != http.StatusNoContent {
			t.Fatalf("DELETE = %d %s, want 204 (also the second time)", res.Status, res.Raw)
		}
	}
	if got := restrictionsOf(t, me); !reflect.DeepEqual(got, []any{"bending"}) {
		t.Errorf("restrictions = %v, want only bending", got)
	}
	if res := me.Delete("/me/restrictions/heights"); res.Status != http.StatusNoContent {
		t.Errorf("DELETE of one never set = %d %s, want 204", res.Status, res.Raw)
	}
}
