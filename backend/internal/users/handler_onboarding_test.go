package users_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// onboardingSteps are the stored step ids, in order. They are permanent.
var onboardingSteps = []string{"home", "baseline", "restrictions", "preferences", "install", "reminders"}

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

func TestABrandNewUserStartsOnboardingAtHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	if got := stepOf(t, app.SignInAs("a@example.com")); got != "home" {
		t.Errorf("step = %q, want home", got)
	}
}

func TestEachStepInOrderLeadsToTheNextAndTheLastLeadsToDone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	if got := stepOf(t, me); got != "baseline" {
		t.Fatalf("after creating the Home, step = %q, want baseline", got)
	}
	for i, step := range onboardingSteps[1:] {
		res := putStep(me, step)
		want := "done"
		if i+2 < len(onboardingSteps) {
			want = onboardingSteps[i+2]
		}
		if res.Status != http.StatusOK || res.Body["step"] != want {
			t.Fatalf("PUT %s = %d %s, want 200 with step %s", step, res.Status, res.Raw, want)
		}
		if got := stepOf(t, me); got != want {
			t.Errorf("after %s, GET step = %q, want %q", step, got, want)
		}
	}
}

func TestProgressNeverMovesBackwardsAndRepeatsAreIdempotent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	apitest.ExpectStatus(t, putStep(me, "restrictions"), http.StatusOK)

	for _, step := range []string{"baseline", "restrictions", "restrictions"} {
		res := putStep(me, step)
		if res.Status != http.StatusOK || res.Body["step"] != "preferences" {
			t.Errorf("PUT %s after restrictions = %d %s, want 200 still at preferences", step, res.Status, res.Raw)
		}
	}
	if got := stepOf(t, me); got != "preferences" {
		t.Errorf("step = %q, want preferences", got)
	}
}

func TestSkippingAheadIsAllowedAndMovesForward(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)

	apitest.ExpectStatus(t, putStep(me, "install"), http.StatusOK)
	if got := stepOf(t, me); got != "reminders" {
		t.Errorf("step = %q, want reminders", got)
	}
}

func TestANewUserWithAStoredStepButNoHomeIsSentToHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	res := putStep(me, "preferences")
	if res.Status != http.StatusOK || res.Body["step"] != "home" {
		t.Fatalf("PUT preferences without a Home = %d %s, want step home", res.Status, res.Raw)
	}
	if got := stepOf(t, me); got != "home" {
		t.Errorf("GET step = %q, want home", got)
	}

	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	if got := stepOf(t, me); got != "install" {
		t.Errorf("after creating the Home, step = %q, want install (progress kept)", got)
	}
}

func TestAUserWithNoHomeIsNeverDoneUnlessStoredDone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	res := putStep(me, "reminders")
	if res.Body["step"] != "home" {
		t.Errorf("PUT reminders without a Home = %s, want home", res.Raw)
	}
	if got := storedStepOf(t, app, "a@example.com"); got == nil || *got != "reminders" {
		t.Errorf("stored step = %v, want reminders (the answer is derived, not stored)", got)
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
		{"home is written by creating it", `{"step":"home"}`, http.StatusBadRequest},
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
	if got := stepOf(t, me); got != "home" {
		t.Errorf("step = %q after rejected writes, want home", got)
	}
}

func TestCreatingAHomeStoresHomeInTheSameTransaction(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)

	if got := storedStepOf(t, app, "a@example.com"); got == nil || *got != "home" {
		t.Errorf("stored step = %v, want home", deref(got))
	}
}

func TestAFailedHomeCreationLeavesProgressAlone(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")

	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("Nowhere/Land", "07:00")), http.StatusBadRequest)

	if got := stepOf(t, me); got != "home" {
		t.Errorf("step = %q, want home", got)
	}
}

func TestAResidentWhoJoinedByInviteSkipsHomeAndStartsAtBaseline(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)
	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, token, nil), http.StatusOK)

	if got := stepOf(t, b); got != "baseline" {
		t.Errorf("step = %q, want baseline", got)
	}
	if got := storedStepOf(t, app, "b@example.com"); got == nil || *got != "home" {
		t.Errorf("stored step = %v, want home", got)
	}
}

func TestAResidentWhoJoinedByInviteIsDoneOnlyAfterTheLastStep(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)
	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, token, nil), http.StatusOK)

	if res := putStep(b, "preferences"); res.Body["step"] != "install" {
		t.Errorf("PUT preferences = %s, want install", res.Raw)
	}
	if res := putStep(b, "reminders"); res.Body["step"] != "done" {
		t.Errorf("PUT reminders = %s, want done", res.Raw)
	}
	if got := storedStepOf(t, app, "b@example.com"); got == nil || *got != "done" {
		t.Errorf("stored step = %v, want done", got)
	}
	// Done is sticky: an old tab's PUT cannot reopen it.
	if res := putStep(b, "install"); res.Body["step"] != "done" {
		t.Errorf("PUT install = %s, want done", res.Raw)
	}
}

func TestAResidentWhoReachedPreferencesBeforeJoiningKeepsTheirPlace(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)
	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, putStep(b, "preferences"), http.StatusOK)
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, token, nil), http.StatusOK)

	if got := stepOf(t, b); got != "install" {
		t.Errorf("step = %q, want install", got)
	}
}

func TestDoneStaysDoneWhenTheUserLeavesTheirHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	apitest.ExpectStatus(t, me.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
	apitest.ExpectStatus(t, putStep(me, "reminders"), http.StatusOK)
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

	apitest.ExpectStatus(t, putStep(a, "preferences"), http.StatusOK)

	if got := stepOf(t, b); got != "home" {
		t.Errorf("b's step = %q, want home", got)
	}
	if got := storedStepOf(t, app, "a@example.com"); got == nil || *got != "preferences" {
		t.Errorf("a's stored step = %v, want preferences", got)
	}
}

func deref(s *string) string {
	if s == nil {
		return "NULL"
	}
	return *s
}

func TestOnboardingSaysWhetherTheCurrentHomeWasJoinedByInvite(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		setup func(t *testing.T, app *apitest.App) *apitest.Client
		want  bool
	}{
		{"creator", func(t *testing.T, app *apitest.App) *apitest.Client {
			return apitest.HomeWithResident(t, app, "b@example.com")
		}, false},
		{"joiner", func(t *testing.T, app *apitest.App) *apitest.Client {
			a := apitest.HomeWithResident(t, app, "a@example.com")
			b := app.SignInAs("b@example.com")
			apitest.ExpectStatus(t, apitest.AcceptInvite(b, apitest.CreateInvite(t, a), nil), http.StatusOK)
			return b
		}, true},
		{"joiner who left then created a Home", func(t *testing.T, app *apitest.App) *apitest.Client {
			a := apitest.HomeWithResident(t, app, "a@example.com")
			b := app.SignInAs("b@example.com")
			apitest.ExpectStatus(t, apitest.AcceptInvite(b, apitest.CreateInvite(t, a), nil), http.StatusOK)
			apitest.ExpectStatus(t, apitest.LeaveHome(b), http.StatusNoContent)
			apitest.ExpectStatus(t, b.Post("/home", apitest.HomeBody("UTC", "07:00")), http.StatusCreated)
			return b
		}, false},
		{"no Home", func(t *testing.T, app *apitest.App) *apitest.Client {
			return app.SignInAs("b@example.com")
		}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			c := tt.setup(t, apitest.Start(t))
			if got := c.Get("/me/onboarding").Body["joined"]; got != tt.want {
				t.Errorf("GET joined = %v, want %v", got, tt.want)
			}
			if got := putStep(c, "baseline").Body["joined"]; got != tt.want {
				t.Errorf("PUT joined = %v, want %v", got, tt.want)
			}
		})
	}
}
