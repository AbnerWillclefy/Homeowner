package residents_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

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

// dailyHome is a Home of the given Residents with Energy 4 every day and three
// Chores due every day, so each Resident has Tasks on any day that is planned.
func dailyHome(t *testing.T, app *apitest.App, emails ...string) []*apitest.Client {
	t.Helper()
	first := apitest.HomeWithResident(t, app, emails[0])
	cs := []*apitest.Client{first}
	for _, e := range emails[1:] {
		app.Clock.Advance(time.Minute)
		cs = append(cs, apitest.ExtraResident(t, app, first, e))
	}
	for _, c := range cs {
		apitest.SetBaseline(t, c, allWeek(4))
	}
	app.Clock.Set(apitest.MondayAt(6))
	for _, n := range []string{"Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"} {
		apitest.CreateChore(t, first, apitest.Chore(n, 1, 2, "normal", []string{}))
	}
	return cs
}

// planAt runs the Allocation job at the given instant and returns the Task ids
// c holds.
func planAt(t *testing.T, app *apitest.App, c *apitest.Client, at time.Time) []string {
	t.Helper()
	app.Clock.Set(at)
	app.RunAllocation(t)
	var ids []string
	for _, tk := range apitest.MineOf(t, c) {
		ids = append(ids, tk["id"].(string))
	}
	if len(ids) == 0 {
		t.Fatalf("no Task planned at %s", at)
	}
	return ids
}

func completeAt(t *testing.T, app *apitest.App, c *apitest.Client, task string, at time.Time) {
	t.Helper()
	app.Clock.Set(at)
	apitest.MustAct(t, c, "complete", task)
}

func daysOf(t *testing.T, res apitest.Response) []map[string]any {
	t.Helper()
	return apitest.TaskList(t, res.Body["days"])
}

func TestDetailListsDaysNewestFirstAndCompletionsOldestFirst(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := dailyHome(t, app, "a@example.com")[0]
	id := ownID(t, a)

	// Monday: the second Task is completed first, so completion order differs
	// from the order the Tasks were planned in.
	mon := planAt(t, app, a, apitest.MondayAt(7))
	completeAt(t, app, a, mon[1], apitest.MondayAt(9))
	completeAt(t, app, a, mon[0], apitest.MondayAt(10))
	tue := planAt(t, app, a, apitest.MondayAt(7).AddDate(0, 0, 1))
	completeAt(t, app, a, tue[0], apitest.MondayAt(9).AddDate(0, 0, 1))
	wed := planAt(t, app, a, apitest.MondayAt(7).AddDate(0, 0, 2))
	completeAt(t, app, a, wed[0], apitest.MondayAt(9).AddDate(0, 0, 2))
	app.Clock.Set(apitest.MondayAt(12).AddDate(0, 0, 2))

	res := detailOf(t, a, id)
	days := daysOf(t, res)
	var dates []string
	for _, d := range days {
		dates = append(dates, d["date"].(string))
	}
	if want := []string{"2026-03-04", "2026-03-03", "2026-03-02"}; !slices.Equal(dates, want) {
		t.Fatalf("days = %v, want %v (newest first): %s", dates, want, res.Raw)
	}
	monday := apitest.TaskList(t, days[2]["completions"])
	if len(monday) != 2 {
		t.Fatalf("Monday completions = %d, want 2: %s", len(monday), res.Raw)
	}
	if first, second := monday[0]["completedAt"], monday[1]["completedAt"]; first != "2026-03-02T09:00:00Z" || second != "2026-03-02T10:00:00Z" {
		t.Errorf("Monday completedAt = %v, %v; want the 09:00 one first", first, second)
	}
	if res.Body["doneLast7Days"] != float64(4) {
		t.Errorf("doneLast7Days = %v, want 4", res.Body["doneLast7Days"])
	}
	if raw := string(res.Raw); !strings.Contains(raw, `"with":[]`) || strings.Contains(raw, `"with":null`) {
		t.Errorf("a solo Completion must have \"with\":[]: %s", raw)
	}
}

func TestDetailStreakEqualsTheListsAndGETStreak(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	cs := dailyHome(t, app, "a@example.com", "b@example.com")
	a := cs[0]
	for day := range 3 {
		at := apitest.MondayAt(7).AddDate(0, 0, day)
		ids := planAt(t, app, a, at)
		completeAt(t, app, a, ids[0], at.Add(2*time.Hour))
	}

	for _, viewer := range cs {
		l := listOf(t, viewer)
		for _, r := range l.Residents {
			got := detailOf(t, viewer, r.ID).Body["streak"]
			if got != float64(r.Streak) {
				t.Errorf("%s: detail streak %v, list streak %d", r.Name, got, r.Streak)
			}
		}
	}
	res := detailOf(t, a, ownID(t, a))
	if res.Body["streak"] != float64(streakOf(t, a)) || res.Body["streak"] != float64(3) {
		t.Errorf("detail streak = %v, GET /home/streak = %d, want both 3", res.Body["streak"], streakOf(t, a))
	}
	if got := detailOf(t, a, ownID(t, cs[1])).Body["streak"]; got != float64(0) {
		t.Errorf("B's streak = %v, want 0 so the parity check tells them apart", got)
	}
}

func TestDetailOfATwoPersonCompletionAppearsOnBothPagesNamingTheOther(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 4, 4)
	app.Clock.Set(apitest.MondayAt(9))
	task := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", task)
	apitest.MustAct(t, b, "accept", task)
	apitest.MustAct(t, b, "complete", task)

	for _, c := range []struct {
		viewer       *apitest.Client
		whose, other *apitest.Client
		wantName     string
	}{{a, a, b, "b"}, {a, b, a, "a"}, {b, a, b, "b"}, {b, b, a, "a"}} {
		res := detailOf(t, c.viewer, ownID(t, c.whose))
		if res.Body["doneLast7Days"] != float64(1) {
			t.Errorf("doneLast7Days = %v, want 1 for each Resident on it: %s", res.Body["doneLast7Days"], res.Raw)
		}
		k := apitest.TaskList(t, apitest.TaskList(t, res.Body["days"])[0]["completions"])[0]
		with := apitest.TaskList(t, k["with"])
		if len(with) != 1 || with[0]["id"] != ownID(t, c.other) || with[0]["name"] != c.wantName {
			t.Errorf("with = %v, want the other Resident (%s)", k["with"], c.wantName)
		}
	}
}

func TestDetailHasExactlyTheAgreedKeysAndLeaksNothingPrivate(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 4, 4)
	app.Clock.Set(apitest.MondayAt(9))
	apitest.ExpectStatus(t, a.Put("/me/name", map[string]any{"name": "Abner"}), http.StatusOK)
	task := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", task)
	apitest.MustAct(t, b, "accept", task)
	apitest.MustAct(t, a, "complete", task)

	// B has every private thing a Resident can have.
	chore := apitest.CreateChore(t, b, apitest.Chore("Secret chore", 7, 2, "normal", []string{"heavy_lifting"}))
	apitest.SetPreference(t, b, chore, "dislike")
	apitest.ExpectStatus(t, b.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
	apitest.CheckIn(t, b, "drained", "bending")

	for _, viewer := range []*apitest.Client{a, b} {
		res := detailOf(t, viewer, ownID(t, a))
		wantKeys(t, "body", res.Body, "avatarTone", "date", "days", "doneLast7Days", "id", "initials", "name", "photoUrl", "streak", "you")
		days := daysOf(t, res)
		if len(days) != 1 {
			t.Fatalf("days = %s, want 1", res.Raw)
		}
		wantKeys(t, "day", days[0], "completions", "date")
		k := apitest.TaskList(t, days[0]["completions"])[0]
		wantKeys(t, "completion", k, "category", "choreId", "choreName", "completedAt", "id", "with")
		with := apitest.TaskList(t, k["with"])
		if len(with) != 1 {
			t.Fatalf("with = %s, want B", res.Raw)
		}
		wantKeys(t, "with entry", with[0], "id", "name")
		if with[0]["name"] != "b" {
			t.Errorf("a name-less partner shows %v, want the email's local part b", with[0]["name"])
		}
		raw := strings.ToLower(string(res.Raw))
		leaks := []string{
			"@", "example.com", userID(t, a), userID(t, b),
			"email", "userid", "energy", "baseline", "checkin", "check-in", "level", "drained",
			"restriction", "preference", "dislike", "heavy_lifting", "bending",
		}
		for _, leak := range leaks {
			if strings.Contains(raw, strings.ToLower(leak)) {
				t.Errorf("body %s contains %q", res.Raw, leak)
			}
		}
	}
}

func TestDetailWindowIsTodayAndSixLocalDatesBackInANonUTCHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("UTC", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	// Sao Paulo is UTC-3 all year: 07:00 local is 10:00 UTC, midnight is 03:00 UTC.
	apitest.ExpectStatus(t, me.Put("/home", apitest.HomeBody("America/Sao_Paulo", "07:00")), http.StatusOK)
	apitest.SetBaseline(t, me, allWeek(4))
	app.Clock.Set(apitest.MondayAt(9))
	for _, n := range []string{"Alpha", "Beta", "Gamma"} {
		apitest.CreateChore(t, me, apitest.Chore(n, 1, 2, "normal", []string{}))
	}

	// One Completion per local date from 2 to 10 March. The one on the 3rd (the
	// eighth day back from the 10th) is at 23:30 local, 02:30 UTC on the 4th,
	// which would be inside the window by its UTC date. The one on the 6th is
	// at 23:30 local too, and must group under the 6th, not the 7th.
	for day := range 9 {
		planned := apitest.MondayAt(10).AddDate(0, 0, day)
		ids := planAt(t, app, me, planned)
		done := planned.Add(5 * time.Hour) // 12:00 local
		if day == 1 || day == 4 {
			done = planned.AddDate(0, 0, 1).Add(-7*time.Hour - 30*time.Minute) // 23:30 local
		}
		completeAt(t, app, me, ids[0], done)
	}
	app.Clock.Set(apitest.MondayAt(10).AddDate(0, 0, 8).Add(6 * time.Hour)) // 10 March, 13:00 local

	res := detailOf(t, me, ownID(t, me))
	if res.Body["date"] != "2026-03-10" {
		t.Errorf("date = %v, want 2026-03-10", res.Body["date"])
	}
	var dates []string
	for _, d := range daysOf(t, res) {
		dates = append(dates, d["date"].(string))
	}
	want := []string{"2026-03-10", "2026-03-09", "2026-03-08", "2026-03-07", "2026-03-06", "2026-03-05", "2026-03-04"}
	if !slices.Equal(dates, want) {
		t.Fatalf("days = %v, want %v (the 4th is six dates back, the 3rd is the eighth day and out)", dates, want)
	}
	if res.Body["doneLast7Days"] != float64(7) {
		t.Errorf("doneLast7Days = %v, want 7", res.Body["doneLast7Days"])
	}
	sixth := apitest.TaskList(t, daysOf(t, res)[4]["completions"])
	if len(sixth) != 1 || sixth[0]["completedAt"] != "2026-03-07T02:30:00Z" {
		t.Errorf("the 6th = %v, want the Completion at 02:30 UTC on the 7th", sixth)
	}
}
