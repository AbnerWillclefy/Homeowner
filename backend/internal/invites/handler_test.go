package invites_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestAnInviteBringsANewResidentIntoTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"]

	created := a.Post("/home/invites", nil)
	apitest.ExpectStatus(t, created, http.StatusCreated)
	if created.Body["expiresAt"] != "2026-03-11T09:00:00Z" {
		t.Errorf("expiresAt = %v, want seven days after the clock", created.Body["expiresAt"])
	}

	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, b.Get("/home"), http.StatusNotFound)
	acc := apitest.AcceptInvite(b, created.Body["token"].(string), nil)
	apitest.ExpectStatus(t, acc, http.StatusOK)
	if acc.Body["id"] != homeID {
		t.Errorf("accept returned %s, want the Home %v", acc.Raw, homeID)
	}
	if got := b.Get("/home"); got.Status != http.StatusOK || got.Body["id"] != homeID {
		t.Errorf("GET /home = %d %s, want the inviting Home", got.Status, got.Raw)
	}
}

func TestAnInviteWorksOnce(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"]
	token := apitest.CreateInvite(t, a)

	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, token, nil), http.StatusOK)

	c := app.SignInAs("c@example.com")
	r := apitest.AcceptInvite(c, token, nil)
	if r.Status != http.StatusGone || r.Body["error"] != "used" {
		t.Fatalf("second accept = %d %s, want 410 used", r.Status, r.Raw)
	}
	apitest.ExpectStatus(t, c.Get("/home"), http.StatusNotFound)
	if got := b.Get("/home"); got.Body["id"] != homeID {
		t.Errorf("first User's Home = %s, want unchanged", got.Raw)
	}
	if r := app.Get("/invites/" + token); r.Status != http.StatusGone || r.Body["error"] != "used" {
		t.Errorf("lookup after use = %d %s, want 410 used", r.Status, r.Raw)
	}
}

func TestAnInviteIsValidForSevenDaysExclusive(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	justBefore := apitest.CreateInvite(t, a)
	atExpiry := apitest.CreateInvite(t, a)

	app.Clock.Advance(7*24*time.Hour - time.Second)
	apitest.ExpectStatus(t, apitest.AcceptInvite(app.SignInAs("b@example.com"), justBefore, nil), http.StatusOK)

	app.Clock.Advance(time.Second)
	c := app.SignInAs("c@example.com")
	r := apitest.AcceptInvite(c, atExpiry, nil)
	if r.Status != http.StatusGone || r.Body["error"] != "expired" {
		t.Fatalf("accept at expiry = %d %s, want 410 expired", r.Status, r.Raw)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 1 {
		t.Errorf("used invites = %d, want 1 (the expired one is not marked used)", n)
	}
	if r := app.Get("/invites/" + atExpiry); r.Status != http.StatusGone || r.Body["error"] != "expired" {
		t.Errorf("lookup at expiry = %d %s, want 410 expired", r.Status, r.Raw)
	}
}

func TestUnknownAndMalformedTokensAreTheSame404AndAuthIsRequired(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := app.SignInAs("b@example.com")

	var want string
	for _, tok := range []string{strings.Repeat("A", 43), "short", "!!!", strings.Repeat("A", 44), strings.Repeat("A", 43) + "="} {
		for _, r := range []apitest.Response{app.Get("/invites/" + tok), apitest.AcceptInvite(b, tok, nil)} {
			if r.Status != http.StatusNotFound {
				t.Fatalf("token %q = %d %s, want 404", tok, r.Status, r.Raw)
			}
			if want == "" {
				want = string(r.Raw)
			}
			if string(r.Raw) != want {
				t.Errorf("token %q body %s differs from %s", tok, r.Raw, want)
			}
		}
	}

	apitest.ExpectStatus(t, app.Post("/home/invites", nil), http.StatusUnauthorized)
	apitest.ExpectStatus(t, app.Post("/invites/"+apitest.CreateInvite(t, a)+"/accept", nil), http.StatusUnauthorized)
}

func TestAResidentOfAnotherHomeMustConfirmLeaving(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	oldHome := a.Get("/home").Body["id"]
	chore := apitest.ChoreIn(t, a, "kitchen", []string{})
	apitest.SetPreference(t, a, chore, "dislike")
	apitest.ExpectStatus(t, a.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)
	apitest.ExpectStatus(t, a.Put("/me/preferences/kitchen", map[string]any{"preference": "like"}), http.StatusNoContent)

	b := apitest.HomeWithResident(t, app, "b@example.com")
	newHome := b.Get("/home").Body["id"]
	token := apitest.CreateInvite(t, b)

	r := apitest.AcceptInvite(a, token, nil)
	if r.Status != http.StatusConflict || r.Body["error"] != "leaves current home" {
		t.Fatalf("accept without confirm = %d %s, want 409 leaves current home", r.Status, r.Raw)
	}
	if got := a.Get("/home"); got.Body["id"] != oldHome {
		t.Errorf("Home after refusal = %s, want unchanged", got.Raw)
	}
	if r := app.Get("/invites/" + token); r.Status != http.StatusOK {
		t.Errorf("Invite after refusal = %d %s, want still usable", r.Status, r.Raw)
	}

	r = apitest.AcceptInvite(a, token, map[string]any{"confirmLeave": true})
	apitest.ExpectStatus(t, r, http.StatusOK)
	if got := a.Get("/home"); got.Body["id"] != newHome {
		t.Errorf("Home after confirm = %s, want the new Home", got.Raw)
	}
	if n := apitest.Count(t, app, `SELECT (SELECT count(*) FROM resident_chore_preferences) + (SELECT count(*) FROM resident_chore_restrictions)`); n != 0 {
		t.Errorf("specific settings left = %d, want 0", n)
	}
	if got := a.Get("/me/profile"); got.Body["preferences"].(map[string]any)["kitchen"] != "like" {
		t.Errorf("general profile = %s, want unchanged", got.Raw)
	}
}

func TestTheLastResidentLeavingByAcceptingDeletesTheOldHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.ChoreIn(t, a, "kitchen", []string{})
	apitest.CreateInvite(t, a)
	b := apitest.HomeWithResident(t, app, "b@example.com")
	token := apitest.CreateInvite(t, b)

	apitest.ExpectStatus(t, apitest.AcceptInvite(a, token, map[string]any{"confirmLeave": true}), http.StatusOK)
	if n := apitest.Count(t, app, `SELECT count(*) FROM homes`); n != 1 {
		t.Errorf("homes = %d, want 1 (the empty one deleted)", n)
	}
	if n := apitest.Count(t, app, `SELECT (SELECT count(*) FROM chores) + (SELECT count(*) FROM invites WHERE used_at IS NULL)`); n != 0 {
		t.Errorf("old Home's chores and open Invites left = %d, want 0", n)
	}
}

func TestAHomeWithOtherResidentsSurvivesALeaveByAccepting(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	homeA := a.Get("/home").Body["id"].(string)
	apitest.ChoreIn(t, a, "kitchen", []string{})
	other := app.SignInAs("other@example.com")
	other.JoinHome(t, homeA)
	b := apitest.HomeWithResident(t, app, "b@example.com")

	apitest.ExpectStatus(t, apitest.AcceptInvite(a, apitest.CreateInvite(t, b), map[string]any{"confirmLeave": true}), http.StatusOK)
	if got := other.Get("/home"); got.Body["id"] != homeA {
		t.Errorf("remaining Resident's Home = %s, want kept", got.Raw)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM chores`); n != 1 {
		t.Errorf("chores = %d, want 1 kept", n)
	}
}

func TestOpeningAnInviteToYourOwnHomeIsNotJoining(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)

	for _, body := range []any{nil, map[string]any{"confirmLeave": true}} {
		r := apitest.AcceptInvite(a, token, body)
		if r.Status != http.StatusConflict || r.Body["error"] != "already_here" {
			t.Fatalf("accept own Home's Invite = %d %s, want 409 already_here", r.Status, r.Raw)
		}
	}
	apitest.ExpectStatus(t, app.Get("/invites/"+token), http.StatusOK)
	apitest.ExpectStatus(t, a.Get("/home"), http.StatusOK)
}

func TestTwoUsersAcceptingOneInviteAtOnceHaveExactlyOneWinner(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)

	statuses := make([]int, 6)
	var wg sync.WaitGroup
	for i := range statuses {
		c := app.SignInAs(fmt.Sprintf("u%d@example.com", i))
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = apitest.AcceptInvite(c, token, nil).Status
		}()
	}
	wg.Wait()

	ok := 0
	for _, s := range statuses {
		switch s {
		case http.StatusOK:
			ok++
		case http.StatusGone:
		default:
			t.Errorf("status %d, want 200 or 410", s)
		}
	}
	if ok != 1 {
		t.Errorf("winners = %d (%v), want exactly 1", ok, statuses)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM residents`); n != 2 {
		t.Errorf("residents = %d, want 2", n)
	}
}

func TestOneUserAcceptingTwoInvitesAtOnceEndsInOneHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.HomeWithResident(t, app, "b@example.com")
	tokens := []string{apitest.CreateInvite(t, a), apitest.CreateInvite(t, b)}
	u := app.SignInAs("u@example.com")

	statuses := make([]int, len(tokens))
	var wg sync.WaitGroup
	for i := range tokens {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = apitest.AcceptInvite(u, tokens[i], nil).Status
		}()
	}
	wg.Wait()

	wins := 0
	for _, s := range statuses {
		if s == http.StatusOK {
			wins++
		}
	}
	if wins != 1 {
		t.Errorf("successful accepts = %d (%v), want exactly 1", wins, statuses)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM residents r JOIN users u ON u.id = r.user_id WHERE u.email = 'u@example.com'`); n != 1 {
		t.Errorf("User's residents rows = %d, want 1", n)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 1 {
		t.Errorf("used invites = %d, want 1 (the loser rolled back)", n)
	}
}

func TestAFailedJoinDoesNotBurnTheInvite(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)
	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, b.Get("/me"), http.StatusOK)

	// Make the residents insert fail, as an outage in the middle would.
	for _, stmt := range []string{
		`CREATE FUNCTION refuse_residents() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'refused'; END $$`,
		`CREATE TRIGGER refuse BEFORE INSERT ON residents FOR EACH ROW EXECUTE FUNCTION refuse_residents()`,
	} {
		if _, err := app.DB.Exec(context.Background(), stmt); err != nil {
			t.Fatal(err)
		}
	}
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, token, nil), http.StatusInternalServerError)
	if n := apitest.Count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 0 {
		t.Errorf("used invites = %d, want 0", n)
	}
	apitest.ExpectStatus(t, app.Get("/invites/"+token), http.StatusOK)
}

func TestLookingAtAnInviteDoesNotUseItUpOrRevealTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)

	for range 3 {
		r := app.Get("/invites/" + token)
		apitest.ExpectStatus(t, r, http.StatusOK)
		if len(r.Body) != 1 || r.Body["valid"] != true {
			t.Fatalf("lookup body = %s, want only the valid flag", r.Raw)
		}
	}
	apitest.ExpectStatus(t, apitest.AcceptInvite(app.SignInAs("b@example.com"), token, nil), http.StatusOK)
}

func TestTheNewResidentRatesTheNewHomesChoresOnly(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	newChore := apitest.ChoreIn(t, a, "kitchen", []string{})
	other := apitest.HomeWithResident(t, app, "other@example.com")
	oldChore := apitest.ChoreIn(t, other, "kitchen", []string{})
	b := app.SignInAs("b@example.com")
	apitest.ExpectStatus(t, apitest.AcceptInvite(b, apitest.CreateInvite(t, a), nil), http.StatusOK)

	apitest.SetPreference(t, b, newChore, "like")
	r := b.Put("/home/chores/"+oldChore+"/preference", map[string]any{"preference": "like"})
	apitest.ExpectStatus(t, r, http.StatusNotFound)
}

func TestCreatingAnInviteNeedsAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	r := app.SignInAs("a@example.com").Post("/home/invites", nil)
	if r.Status != http.StatusNotFound || r.Body["error"] != "no home" {
		t.Fatalf("POST /home/invites = %d %s, want 404 no home", r.Status, r.Raw)
	}
}

func TestAHomeCannotHoldMoreThanTenOpenInvites(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	for range 10 {
		apitest.CreateInvite(t, a)
	}
	apitest.ExpectStatus(t, a.Post("/home/invites", nil), http.StatusTooManyRequests)
	app.Clock.Advance(7 * 24 * time.Hour)
	apitest.CreateInvite(t, a)
}

func TestAnInviteOutlivesItsCreatorLeavingTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	other := app.SignInAs("other@example.com")
	other.JoinHome(t, a.Get("/home").Body["id"].(string))
	token := apitest.CreateInvite(t, a)
	if _, err := app.DB.Exec(context.Background(),
		`DELETE FROM residents WHERE user_id = (SELECT id FROM users WHERE email = 'a@example.com')`); err != nil {
		t.Fatal(err)
	}
	apitest.ExpectStatus(t, apitest.AcceptInvite(app.SignInAs("b@example.com"), token, nil), http.StatusOK)
}

func TestInviteTokensNeverReachTheLogs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	token := apitest.CreateInvite(t, a)
	app.Get("/invites/" + token)
	apitest.AcceptInvite(app.SignInAs("b@example.com"), token, nil)
	apitest.AcceptInvite(app.SignInAs("c@example.com"), token, nil)

	if app.Logs.Contains(token) {
		t.Errorf("the log contains the Invite token:\n%s", app.Logs.String())
	}
}
