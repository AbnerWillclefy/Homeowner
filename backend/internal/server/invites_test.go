package server_test

import (
	"net/http"
	"testing"

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
