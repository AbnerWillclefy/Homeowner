package server_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// onboardingSteps are the stored step ids, in order. They are permanent.
var onboardingSteps = []string{"install", "reminders", "baseline", "restrictions", "preferences", "home"}

func stepOf(t *testing.T, c *apitest.Client) string {
	t.Helper()
	res := c.Get("/me/onboarding")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /me/onboarding = %d %s, want 200", res.Status, res.Raw)
	}
	step, _ := res.Body["step"].(string)
	return step
}

func TestABrandNewUserStartsOnboardingAtInstall(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	if got := stepOf(t, app.SignInAs("a@example.com")); got != "install" {
		t.Errorf("step = %q, want install", got)
	}
}
