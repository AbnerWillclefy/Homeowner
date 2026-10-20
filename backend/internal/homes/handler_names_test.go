package homes_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

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
