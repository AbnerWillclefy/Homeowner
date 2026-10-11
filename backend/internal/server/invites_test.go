package server_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// createInvite has c make an Invite and returns its token.
func createInvite(t *testing.T, c *apitest.Client) string {
	t.Helper()
	r := c.Post("/home/invites", nil)
	expectStatus(t, r, http.StatusCreated)
	tok, _ := r.Body["token"].(string)
	if tok == "" {
		t.Fatalf("no token: %s", r.Raw)
	}
	return tok
}

func acceptInvite(c *apitest.Client, token string, body any) apitest.Response {
	return c.Post("/invites/"+token+"/accept", body)
}

func count(t *testing.T, app *apitest.App, query string, args ...any) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestAnInviteBringsANewResidentIntoTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"]

	created := a.Post("/home/invites", nil)
	expectStatus(t, created, http.StatusCreated)
	if created.Body["expiresAt"] != "2026-03-11T09:00:00Z" {
		t.Errorf("expiresAt = %v, want seven days after the clock", created.Body["expiresAt"])
	}

	b := app.SignInAs("b@example.com")
	expectStatus(t, b.Get("/home"), http.StatusNotFound)
	acc := acceptInvite(b, created.Body["token"].(string), nil)
	expectStatus(t, acc, http.StatusOK)
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
	a := homeWithResident(t, app, "a@example.com")
	homeID := a.Get("/home").Body["id"]
	token := createInvite(t, a)

	b := app.SignInAs("b@example.com")
	expectStatus(t, acceptInvite(b, token, nil), http.StatusOK)

	c := app.SignInAs("c@example.com")
	r := acceptInvite(c, token, nil)
	if r.Status != http.StatusGone || r.Body["error"] != "used" {
		t.Fatalf("second accept = %d %s, want 410 used", r.Status, r.Raw)
	}
	expectStatus(t, c.Get("/home"), http.StatusNotFound)
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
	a := homeWithResident(t, app, "a@example.com")
	justBefore := createInvite(t, a)
	atExpiry := createInvite(t, a)

	app.Clock.Advance(7*24*time.Hour - time.Second)
	expectStatus(t, acceptInvite(app.SignInAs("b@example.com"), justBefore, nil), http.StatusOK)

	app.Clock.Advance(time.Second)
	c := app.SignInAs("c@example.com")
	r := acceptInvite(c, atExpiry, nil)
	if r.Status != http.StatusGone || r.Body["error"] != "expired" {
		t.Fatalf("accept at expiry = %d %s, want 410 expired", r.Status, r.Raw)
	}
	if n := count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 1 {
		t.Errorf("used invites = %d, want 1 (the expired one is not marked used)", n)
	}
	if r := app.Get("/invites/" + atExpiry); r.Status != http.StatusGone || r.Body["error"] != "expired" {
		t.Errorf("lookup at expiry = %d %s, want 410 expired", r.Status, r.Raw)
	}
}

func TestUnknownAndMalformedTokensAreTheSame404AndAuthIsRequired(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	b := app.SignInAs("b@example.com")

	var want string
	for _, tok := range []string{strings.Repeat("A", 43), "short", "!!!", strings.Repeat("A", 44), strings.Repeat("A", 43) + "="} {
		for _, r := range []apitest.Response{app.Get("/invites/" + tok), acceptInvite(b, tok, nil)} {
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

	expectStatus(t, app.Post("/home/invites", nil), http.StatusUnauthorized)
	expectStatus(t, app.Post("/invites/"+createInvite(t, a)+"/accept", nil), http.StatusUnauthorized)
}

func TestAResidentOfAnotherHomeMustConfirmLeaving(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	oldHome := a.Get("/home").Body["id"]
	chore := choreIn(t, a, "kitchen", []string{})
	setPref(t, a, chore, "dislike")
	expectStatus(t, a.Put("/home/chores/"+chore+"/restriction", nil), http.StatusNoContent)
	expectStatus(t, a.Put("/me/preferences/kitchen", map[string]any{"preference": "like"}), http.StatusNoContent)

	b := homeWithResident(t, app, "b@example.com")
	newHome := b.Get("/home").Body["id"]
	token := createInvite(t, b)

	r := acceptInvite(a, token, nil)
	if r.Status != http.StatusConflict || r.Body["error"] != "leaves current home" {
		t.Fatalf("accept without confirm = %d %s, want 409 leaves current home", r.Status, r.Raw)
	}
	if got := a.Get("/home"); got.Body["id"] != oldHome {
		t.Errorf("Home after refusal = %s, want unchanged", got.Raw)
	}
	if r := app.Get("/invites/" + token); r.Status != http.StatusOK {
		t.Errorf("Invite after refusal = %d %s, want still usable", r.Status, r.Raw)
	}

	r = acceptInvite(a, token, map[string]any{"confirmLeave": true})
	expectStatus(t, r, http.StatusOK)
	if got := a.Get("/home"); got.Body["id"] != newHome {
		t.Errorf("Home after confirm = %s, want the new Home", got.Raw)
	}
	if n := count(t, app, `SELECT (SELECT count(*) FROM resident_chore_preferences) + (SELECT count(*) FROM resident_chore_restrictions)`); n != 0 {
		t.Errorf("specific settings left = %d, want 0", n)
	}
	if got := a.Get("/me/profile"); got.Body["preferences"].(map[string]any)["kitchen"] != "like" {
		t.Errorf("general profile = %s, want unchanged", got.Raw)
	}
}

func TestTheLastResidentLeavingByAcceptingDeletesTheOldHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	choreIn(t, a, "kitchen", []string{})
	createInvite(t, a)
	b := homeWithResident(t, app, "b@example.com")
	token := createInvite(t, b)

	expectStatus(t, acceptInvite(a, token, map[string]any{"confirmLeave": true}), http.StatusOK)
	if n := count(t, app, `SELECT count(*) FROM homes`); n != 1 {
		t.Errorf("homes = %d, want 1 (the empty one deleted)", n)
	}
	if n := count(t, app, `SELECT (SELECT count(*) FROM chores) + (SELECT count(*) FROM invites WHERE used_at IS NULL)`); n != 0 {
		t.Errorf("old Home's chores and open Invites left = %d, want 0", n)
	}
}

func TestAHomeWithOtherResidentsSurvivesALeaveByAccepting(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	homeA := a.Get("/home").Body["id"].(string)
	choreIn(t, a, "kitchen", []string{})
	other := app.SignInAs("other@example.com")
	other.JoinHome(t, homeA)
	b := homeWithResident(t, app, "b@example.com")

	expectStatus(t, acceptInvite(a, createInvite(t, b), map[string]any{"confirmLeave": true}), http.StatusOK)
	if got := other.Get("/home"); got.Body["id"] != homeA {
		t.Errorf("remaining Resident's Home = %s, want kept", got.Raw)
	}
	if n := count(t, app, `SELECT count(*) FROM chores`); n != 1 {
		t.Errorf("chores = %d, want 1 kept", n)
	}
}

func TestOpeningAnInviteToYourOwnHomeIsNotJoining(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)

	for _, body := range []any{nil, map[string]any{"confirmLeave": true}} {
		r := acceptInvite(a, token, body)
		if r.Status != http.StatusConflict || r.Body["error"] != "already_here" {
			t.Fatalf("accept own Home's Invite = %d %s, want 409 already_here", r.Status, r.Raw)
		}
	}
	expectStatus(t, app.Get("/invites/"+token), http.StatusOK)
	expectStatus(t, a.Get("/home"), http.StatusOK)
}

func TestTwoUsersAcceptingOneInviteAtOnceHaveExactlyOneWinner(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)

	statuses := make([]int, 6)
	var wg sync.WaitGroup
	for i := range statuses {
		c := app.SignInAs(fmt.Sprintf("u%d@example.com", i))
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = acceptInvite(c, token, nil).Status
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
	if n := count(t, app, `SELECT count(*) FROM residents`); n != 2 {
		t.Errorf("residents = %d, want 2", n)
	}
}

func TestOneUserAcceptingTwoInvitesAtOnceEndsInOneHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	b := homeWithResident(t, app, "b@example.com")
	tokens := []string{createInvite(t, a), createInvite(t, b)}
	u := app.SignInAs("u@example.com")

	statuses := make([]int, len(tokens))
	var wg sync.WaitGroup
	for i := range tokens {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i] = acceptInvite(u, tokens[i], nil).Status
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
	if n := count(t, app, `SELECT count(*) FROM residents r JOIN users u ON u.id = r.user_id WHERE u.email = 'u@example.com'`); n != 1 {
		t.Errorf("User's residents rows = %d, want 1", n)
	}
	if n := count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 1 {
		t.Errorf("used invites = %d, want 1 (the loser rolled back)", n)
	}
}

func TestAFailedJoinDoesNotBurnTheInvite(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)
	b := app.SignInAs("b@example.com")
	expectStatus(t, b.Get("/me"), http.StatusOK)

	// Make the residents insert fail, as an outage in the middle would.
	for _, stmt := range []string{
		`CREATE FUNCTION refuse_residents() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'refused'; END $$`,
		`CREATE TRIGGER refuse BEFORE INSERT ON residents FOR EACH ROW EXECUTE FUNCTION refuse_residents()`,
	} {
		if _, err := app.DB.Exec(context.Background(), stmt); err != nil {
			t.Fatal(err)
		}
	}
	expectStatus(t, acceptInvite(b, token, nil), http.StatusInternalServerError)
	if n := count(t, app, `SELECT count(*) FROM invites WHERE used_at IS NOT NULL`); n != 0 {
		t.Errorf("used invites = %d, want 0", n)
	}
	expectStatus(t, app.Get("/invites/"+token), http.StatusOK)
}

func TestLookingAtAnInviteDoesNotUseItUpOrRevealTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)

	for range 3 {
		r := app.Get("/invites/" + token)
		expectStatus(t, r, http.StatusOK)
		if len(r.Body) != 1 || r.Body["valid"] != true {
			t.Fatalf("lookup body = %s, want only the valid flag", r.Raw)
		}
	}
	expectStatus(t, acceptInvite(app.SignInAs("b@example.com"), token, nil), http.StatusOK)
}

func TestTheNewResidentRatesTheNewHomesChoresOnly(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	newChore := choreIn(t, a, "kitchen", []string{})
	other := homeWithResident(t, app, "other@example.com")
	oldChore := choreIn(t, other, "kitchen", []string{})
	b := app.SignInAs("b@example.com")
	expectStatus(t, acceptInvite(b, createInvite(t, a), nil), http.StatusOK)

	setPref(t, b, newChore, "like")
	r := b.Put("/home/chores/"+oldChore+"/preference", map[string]any{"preference": "like"})
	expectStatus(t, r, http.StatusNotFound)
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
	a := homeWithResident(t, app, "a@example.com")
	for range 10 {
		createInvite(t, a)
	}
	expectStatus(t, a.Post("/home/invites", nil), http.StatusTooManyRequests)
	app.Clock.Advance(7 * 24 * time.Hour)
	createInvite(t, a)
}

func TestAnInviteOutlivesItsCreatorLeavingTheHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	other := app.SignInAs("other@example.com")
	other.JoinHome(t, a.Get("/home").Body["id"].(string))
	token := createInvite(t, a)
	if _, err := app.DB.Exec(context.Background(),
		`DELETE FROM residents WHERE user_id = (SELECT id FROM users WHERE email = 'a@example.com')`); err != nil {
		t.Fatal(err)
	}
	expectStatus(t, acceptInvite(app.SignInAs("b@example.com"), token, nil), http.StatusOK)
}

func TestInviteTokensNeverReachTheLogs(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	token := createInvite(t, a)
	app.Get("/invites/" + token)
	acceptInvite(app.SignInAs("b@example.com"), token, nil)
	acceptInvite(app.SignInAs("c@example.com"), token, nil)

	if app.Logs.Contains(token) {
		t.Errorf("the log contains the Invite token:\n%s", app.Logs.String())
	}
}
