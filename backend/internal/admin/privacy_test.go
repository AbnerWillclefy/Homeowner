package admin_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// walk calls visit for every object key and every string value in v.
func walk(v any, key func(string), str func(string)) {
	switch x := v.(type) {
	case map[string]any:
		for k, child := range x {
			key(k)
			walk(child, key, str)
		}
	case []any:
		for _, child := range x {
			walk(child, key, str)
		}
	case string:
		str(x)
	}
}

func TestOverviewLeaksNoPersonalData(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.TwoResidents(t) // Chores One..Five
	if r := a.Put("/me/name", map[string]any{"name": "Alice Anderson"}); r.Status != http.StatusOK && r.Status != http.StatusNoContent {
		t.Fatalf("PUT /me/name = %d %s", r.Status, r.Raw)
	}
	apitest.CheckIn(t, b, "normal")
	mine := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", mine)
	secrets := []string{"a@example.com", "b@example.com", "Alice Anderson", "One", "Two", "Three", "Four", "Five"}
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/overview?range=30d")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /admin/overview = %d %s", res.Status, res.Raw)
	}
	var decoded any
	if err := json.Unmarshal(res.Raw, &decoded); err != nil {
		t.Fatal(err)
	}

	forbidden := map[string]bool{"email": true, "name": true, "displayName": true, "userId": true, "user_id": true,
		"title": true, "choreName": true}
	walk(decoded, func(k string) {
		if forbidden[k] {
			t.Errorf("response has the key %q: %s", k, res.Raw)
		}
	}, func(s string) {
		for _, secret := range secrets {
			if strings.EqualFold(s, secret) || strings.Contains(s, "@") {
				t.Errorf("response has the value %q", s)
			}
		}
	})

	// The whole key set is known, so a new field must be added here on purpose.
	keys := map[string]bool{}
	walk(decoded, func(k string) { keys[k] = true }, func(string) {})
	for _, k := range []string{"range", "from", "to", "totals", "users", "homes", "residents", "chores", "active",
		"days", "date", "runs", "rejected", "fallbacks", "checkins", "completions", "refuses", "takes",
		"swapsAccepted", "pushes", "delivered", "failed", "gone", "unknown"} {
		if !keys[k] {
			t.Errorf("response lacks the key %q", k)
		}
		delete(keys, k)
	}
	if len(keys) != 0 {
		t.Errorf("response has unexpected keys %v", keys)
	}
}
