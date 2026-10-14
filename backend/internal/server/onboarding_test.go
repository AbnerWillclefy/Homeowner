package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
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

func putStep(c *apitest.Client, step string) apitest.Response {
	return c.Put("/me/onboarding", map[string]any{"step": step})
}

// storedStepOf reads the column itself, for the cases where GET would give the
// same answer whether or not it was stored.
func storedStepOf(t *testing.T, app *apitest.App, email string) *string {
	t.Helper()
	var step *string
	err := app.DB.QueryRow(context.Background(),
		`SELECT onboarding_step FROM users WHERE email = $1`, email).Scan(&step)
	if err != nil {
		t.Fatal(err)
	}
	return step
}

func TestABrandNewUserStartsOnboardingAtInstall(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	if got := stepOf(t, app.SignInAs("a@example.com")); got != "install" {
		t.Errorf("step = %q, want install", got)
	}
}

func TestEachStepInOrderLeadsToTheNextAndTheHomeLeadsToDone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	for i, step := range onboardingSteps[:5] {
		res := putStep(me, step)
		want := onboardingSteps[i+1]
		if res.Status != http.StatusOK || res.Body["step"] != want {
			t.Fatalf("PUT %s = %d %s, want 200 with step %s", step, res.Status, res.Raw, want)
		}
		if got := stepOf(t, me); got != want {
			t.Errorf("after %s, GET step = %q, want %q", step, got, want)
		}
	}
	expectStatus(t, me.Post("/home", homeBody("UTC", "07:00")), http.StatusCreated)
	if got := stepOf(t, me); got != "done" {
		t.Errorf("after creating the Home, step = %q, want done", got)
	}
}

func TestProgressNeverMovesBackwardsAndRepeatsAreIdempotent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	expectStatus(t, putStep(me, "baseline"), http.StatusOK)

	for _, step := range []string{"install", "reminders", "baseline", "baseline"} {
		res := putStep(me, step)
		if res.Status != http.StatusOK || res.Body["step"] != "restrictions" {
			t.Errorf("PUT %s after baseline = %d %s, want 200 still at restrictions", step, res.Status, res.Raw)
		}
	}
	if got := stepOf(t, me); got != "restrictions" {
		t.Errorf("step = %q, want restrictions", got)
	}
}

func TestSkippingAheadIsAllowedAndMovesForward(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	// Someone already standalone never saw install.
	expectStatus(t, putStep(me, "reminders"), http.StatusOK)
	if got := stepOf(t, me); got != "baseline" {
		t.Errorf("step = %q, want baseline", got)
	}
}

func TestUnacceptableOnboardingBodiesAreRejectedAndStoreNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	cases := []struct {
		name string
		body string
		want int
	}{
		{"unknown step", `{"step":"party"}`, http.StatusBadRequest},
		{"empty step", `{"step":""}`, http.StatusBadRequest},
		{"missing step", `{}`, http.StatusBadRequest},
		{"home is completed by creating it", `{"step":"home"}`, http.StatusBadRequest},
		{"done cannot be written", `{"step":"done"}`, http.StatusBadRequest},
		{"malformed JSON", `{"step":`, http.StatusBadRequest},
		{"unknown field", `{"step":"install","extra":1}`, http.StatusBadRequest},
		{"oversize body", `{"step":"install","pad":"` + strings.Repeat("x", 4096) + `"}`, http.StatusRequestEntityTooLarge},
	}
	for _, c := range cases {
		res := me.SendRaw(http.MethodPut, "/me/onboarding", []byte(c.body))
		if res.Status != c.want {
			t.Errorf("%s: got %d %s, want %d", c.name, res.Status, res.Raw, c.want)
		}
	}
	if res := putStep(me, "party"); res.Body["code"] != "invalid_step" {
		t.Errorf("unknown step body = %s, want code invalid_step", res.Raw)
	}
	if got := storedStepOf(t, app, "a@example.com"); got != nil {
		t.Errorf("stored step = %q after rejected writes, want null", *got)
	}
	if got := stepOf(t, me); got != "install" {
		t.Errorf("step = %q after rejected writes, want install", got)
	}
}

func TestCreatingAHomeStoresDoneInTheSameTransaction(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	expectStatus(t, putStep(me, "baseline"), http.StatusOK)

	expectStatus(t, me.Post("/home", homeBody("UTC", "07:00")), http.StatusCreated)

	if got := storedStepOf(t, app, "a@example.com"); got == nil || *got != "done" {
		t.Errorf("stored step = %v, want done", got)
	}
}

func TestAFailedHomeCreationLeavesProgressAlone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	expectStatus(t, me.Post("/home", homeBody("Nowhere/Land", "07:00")), http.StatusBadRequest)

	if got := stepOf(t, me); got != "install" {
		t.Errorf("step = %q, want install", got)
	}
}

func TestAResidentWhoJoinedByInviteStillWalksTheirOwnSteps(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)
	b := app.SignInAs("b@example.com")
	expectStatus(t, acceptInvite(b, token, nil), http.StatusOK)

	if got := stepOf(t, b); got != "install" {
		t.Errorf("step = %q, want install", got)
	}
}

func TestAResidentWhoJoinedByInviteSkipsCreatingAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)
	b := app.SignInAs("b@example.com")
	expectStatus(t, acceptInvite(b, token, nil), http.StatusOK)

	if res := putStep(b, "preferences"); res.Body["step"] != "done" {
		t.Errorf("PUT preferences = %s, want done", res.Raw)
	}
	if got := storedStepOf(t, app, "b@example.com"); got == nil || *got != "done" {
		t.Errorf("stored step = %v, want done", got)
	}
}

func TestAResidentWhoReachedTheHomeStepBeforeJoiningIsDone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)
	b := app.SignInAs("b@example.com")
	expectStatus(t, putStep(b, "preferences"), http.StatusOK)
	expectStatus(t, acceptInvite(b, token, nil), http.StatusOK)

	if got := stepOf(t, b); got != "done" {
		t.Errorf("step = %q, want done", got)
	}
	// Done is sticky: an old tab's PUT cannot reopen it.
	if res := putStep(b, "install"); res.Body["step"] != "done" {
		t.Errorf("PUT install = %s, want done", res.Raw)
	}
}

func TestDoneStaysDoneWhenTheUserLeavesTheirHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	expectStatus(t, me.Post("/home", homeBody("UTC", "07:00")), http.StatusCreated)
	if _, err := app.DB.Exec(context.Background(), `DELETE FROM residents`); err != nil {
		t.Fatal(err)
	}

	if got := stepOf(t, me); got != "done" {
		t.Errorf("step = %q, want done", got)
	}
}

func TestOnboardingNeedsASignedInUser(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	if res := app.Get("/me/onboarding"); res.Status != http.StatusUnauthorized {
		t.Errorf("GET without a token = %d, want 401", res.Status)
	}
	if res := app.Put("/me/onboarding", map[string]any{"step": "install"}); res.Status != http.StatusUnauthorized {
		t.Errorf("PUT without a token = %d, want 401", res.Status)
	}

	noAuth := apitest.Start(t, apitest.WithoutAuth())
	if res := noAuth.Get("/me/onboarding"); res.Status != http.StatusServiceUnavailable {
		t.Errorf("GET without auth configured = %d, want 503", res.Status)
	}
	if res := noAuth.Put("/me/onboarding", map[string]any{"step": "install"}); res.Status != http.StatusServiceUnavailable {
		t.Errorf("PUT without auth configured = %d, want 503", res.Status)
	}
}

func TestOneUsersProgressIsNotAnothers(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a, b := app.SignInAs("a@example.com"), app.SignInAs("b@example.com")

	expectStatus(t, putStep(a, "preferences"), http.StatusOK)

	if got := stepOf(t, b); got != "install" {
		t.Errorf("b's step = %q, want install", got)
	}
	if got := stepOf(t, a); got != "home" {
		t.Errorf("a's step = %q, want home", got)
	}
}
