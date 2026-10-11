package server_test

import (
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
