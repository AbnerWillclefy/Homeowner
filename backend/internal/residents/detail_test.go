package residents_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// GET /home/residents/{id}: one Resident, their Streak and the last 7 days.

func detail(c *apitest.Client, id string) apitest.Response {
	return c.Get("/home/residents/" + id)
}

func detailOf(t *testing.T, c *apitest.Client, id string) apitest.Response {
	t.Helper()
	res := detail(c, id)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /home/residents/%s = %d %s, want 200", id, res.Status, res.Raw)
	}
	return res
}

func ownID(t *testing.T, c *apitest.Client) string {
	t.Helper()
	return listOf(t, c).Residents[0].ID
}

const unknownID = "0b8e5f0e-5d1c-4f43-9a55-6a2f0f6f7a11"

func TestDetailNeedsATokenAndAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	apitest.ExpectStatus(t, app.Get("/home/residents/"+unknownID), http.StatusUnauthorized)
	res := detail(app.SignInAs("a@example.com"), unknownID)
	if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
		t.Errorf("without a Home: %d %s, want 404 no home", res.Status, res.Raw)
	}
}

func TestDetailOfTheCallersOwnIDWorksAndIsYou(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "maria.silva@example.com")
	b := apitest.ExtraResident(t, app, a, "bruno@example.com")

	res := detailOf(t, a, ownID(t, a))
	if res.Body["you"] != true || res.Body["name"] != "maria.silva" || res.Body["initials"] != "MS" {
		t.Errorf("own detail = %s, want you true, name maria.silva, initials MS", res.Raw)
	}
	if res.Body["id"] != ownID(t, a) {
		t.Errorf("id = %v, want %s", res.Body["id"], ownID(t, a))
	}
	if got := detailOf(t, a, ownID(t, b)); got.Body["you"] != false || got.Body["name"] != "bruno" {
		t.Errorf("a housemate's detail = %s, want you false and name bruno", got.Raw)
	}
}

func TestDetailWithNoCompletionsIsZeroAndAnEmptyArray(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")

	res := detailOf(t, a, ownID(t, a))
	if res.Body["doneLast7Days"] != float64(0) || res.Body["streak"] != float64(0) {
		t.Errorf("body = %s, want doneLast7Days 0 and streak 0", res.Raw)
	}
	if !strings.Contains(string(res.Raw), `"days":[]`) {
		t.Errorf("body %s, want \"days\":[]", res.Raw)
	}
}

func TestDetailAnswersTheSame404ForMalformedUnknownForeignAndDepartedIDs(t *testing.T) {
	t.Parallel()
	app, cs := homeOf(t, "a@example.com", "b@example.com")
	other := apitest.HomeWithResident(t, app, "other@example.com")
	foreign := ownID(t, other)
	departed := ownID(t, cs[1])
	apitest.ExpectStatus(t, apitest.LeaveHome(cs[1]), http.StatusNoContent)

	var first string
	for i, id := range []string{"not-a-uuid", unknownID, foreign, departed, "me"} {
		res := detail(cs[0], id)
		if res.Status != http.StatusNotFound || res.Body["error"] != "resident not found" {
			t.Errorf("GET /home/residents/%s = %d %s, want 404 resident not found", id, res.Status, res.Raw)
		}
		if i == 0 {
			first = string(res.Raw)
		} else if string(res.Raw) != first {
			t.Errorf("404 body for %s is %q, want the same as %q", id, res.Raw, first)
		}
	}
}

func TestDetailRejectsAMalformedIDWithoutAskingTheDatabase(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")

	base := app.QueriesFor(func() { a.Get("/home") })
	got := app.QueriesFor(func() { detail(a, "not-a-uuid") })
	if base == 0 || got != base {
		t.Errorf("malformed id ran %d queries, GET /home runs %d (the middleware's); want equal", got, base)
	}
}
