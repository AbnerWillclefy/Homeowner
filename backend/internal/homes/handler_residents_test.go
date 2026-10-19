package homes_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func residentsOf(t *testing.T, c *apitest.Client) []map[string]any {
	t.Helper()
	res := c.Get("/home/residents")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /home/residents = %d %s, want 200", res.Status, res.Raw)
	}
	var out []map[string]any
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatalf("body is not an array of residents: %s", res.Raw)
	}
	return out
}

func TestResidentsNeedATokenAndAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	apitest.ExpectStatus(t, app.Get("/home/residents"), http.StatusUnauthorized)
	res := app.SignInAs("a@example.com").Get("/home/residents")
	if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
		t.Errorf("without a Home: %d %s, want 404 no home", res.Status, res.Raw)
	}
}

func TestResidentsListShowsNamesTheFallbackAndWhoIsMe(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "abner@example.com")
	app.Clock.Advance(time.Minute) // the fake clock stands still, so joins would tie
	b := apitest.ExtraResident(t, app, a, "bruna.souza@example.com")
	apitest.ExpectStatus(t, a.Put("/me/name", map[string]any{"name": "Abner"}), http.StatusOK)

	// A User in another Home must not appear.
	apitest.HomeWithResident(t, app, "other@example.com").Put("/me/name", map[string]any{"name": "Elsewhere"})

	for _, c := range []struct {
		viewer *apitest.Client
		meIs   string
	}{{a, "Abner"}, {b, "bruna.souza"}} {
		got := residentsOf(t, c.viewer)
		if len(got) != 2 {
			t.Fatalf("residents = %v, want 2", got)
		}
		// The order is join order, so the list does not reshuffle.
		if got[0]["name"] != "Abner" || got[1]["name"] != "bruna.souza" {
			t.Errorf("names = %v, %v; want Abner then bruna.souza", got[0]["name"], got[1]["name"])
		}
		for _, r := range got {
			if r["residentId"] == "" || r["userId"] == "" {
				t.Errorf("row %v lacks ids", r)
			}
			if v, ok := r["photoUrl"]; !ok || v != nil {
				t.Errorf("photoUrl = %v (present %v), want null", v, ok)
			}
			if r["me"] != (r["name"] == c.meIs) {
				t.Errorf("row %v: me wrong for viewer %s", r, c.meIs)
			}
		}
	}
}

func TestResidentsListNeverCarriesAnEmail(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "abner@example.com")
	apitest.ExtraResident(t, app, a, "bruna.souza@example.com")

	res := a.Get("/home/residents")
	raw := string(res.Raw)
	for _, leak := range []string{"bruna.souza@", "example.com", "email"} {
		if strings.Contains(raw, leak) {
			t.Errorf("body %s contains %q", raw, leak)
		}
	}
	if !strings.Contains(raw, "bruna.souza") {
		t.Errorf("body %s lacks the local part", res.Raw)
	}
}

func TestANameReachesNeitherTheLLMPromptNorAPush(t *testing.T) {
	t.Parallel()
	const sentinel = "ZZNAMEZZ"
	app := apitest.Start(t, apitest.WithPush("k"))
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.ExpectStatus(t, c.Put("/me/name", map[string]any{"name": sentinel}), http.StatusOK)
		apitest.SetBaseline(t, c, map[string]any{"monday": 4})
	}
	for _, c := range []*apitest.Client{a, b} {
		apitest.ExpectStatus(t, c.Put("/push/subscription", map[string]any{
			"endpoint": "https://push.example.com/send/" + c.Token[:4],
			"keys": map[string]string{
				"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
				"auth":   "tBHItJI5svbpez7KI4CCXg",
			},
		}), http.StatusNoContent)
	}
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"One", "Two", "Three"} {
		apitest.CreateChore(t, a, apitest.Chore(n, 7, 2, "normal", []string{}))
	}
	fake := llmalloc.NewFakeClient()
	app.UseLLM(llmalloc.New(fake), 10, time.Second)
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)

	if fake.Calls() == 0 {
		t.Fatal("the LLM was never asked, so the test proves nothing")
	}
	if req := fake.LastRequest(); strings.Contains(req.System+req.User, sentinel) {
		t.Errorf("the prompt contains a name: %s", req.User)
	}
	for _, s := range app.Push.Sent() {
		if p := s.Payload; strings.Contains(p.Title+p.Body+p.URL, sentinel) {
			t.Errorf("a push payload contains a name: %+v", p)
		}
	}
}
