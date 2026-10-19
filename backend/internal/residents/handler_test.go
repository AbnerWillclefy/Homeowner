package residents_test

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// March 2026: the 2nd is a Monday. The harness Home is in UTC and plans at 07:00.

type resident struct {
	ID         string
	You        bool
	Name       string
	Streak     int
	DoneToday  int
	PhotoURL   any
	Initials   string
	AvatarTone string
}

type list struct {
	Date      string
	Residents []resident
	Raw       string
}

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}

func wantKeys(t *testing.T, what string, got map[string]any, want ...string) {
	t.Helper()
	if keys := sortedKeys(got); !slices.Equal(keys, want) {
		t.Errorf("%s keys = %v, want exactly %v", what, keys, want)
	}
}

func listOf(t *testing.T, c *apitest.Client) list {
	t.Helper()
	res := c.Get("/home/residents")
	if res.Status != http.StatusOK {
		t.Fatalf("GET /home/residents = %d %s, want 200", res.Status, res.Raw)
	}
	out := list{Raw: string(res.Raw)}
	out.Date, _ = res.Body["date"].(string)
	items, ok := res.Body["residents"].([]any)
	if !ok {
		t.Fatalf("residents is not an array: %s", res.Raw)
	}
	for _, it := range items {
		m := it.(map[string]any)
		r := resident{PhotoURL: m["photoUrl"]}
		r.ID, _ = m["id"].(string)
		r.You, _ = m["you"].(bool)
		r.Name, _ = m["name"].(string)
		r.Initials, _ = m["initials"].(string)
		r.AvatarTone, _ = m["avatarTone"].(string)
		s, _ := m["streak"].(float64)
		d, _ := m["doneToday"].(float64)
		r.Streak, r.DoneToday = int(s), int(d)
		out.Residents = append(out.Residents, r)
	}
	return out
}

func streakOf(t *testing.T, c *apitest.Client) int {
	t.Helper()
	r := c.Get("/home/streak")
	cur, ok := r.Body["current"].(float64)
	if r.Status != http.StatusOK || !ok {
		t.Fatalf("GET /home/streak = %d %s", r.Status, r.Raw)
	}
	return int(cur)
}

func names(l list) []string {
	var out []string
	for _, r := range l.Residents {
		out = append(out, r.Name)
	}
	return out
}

func userID(t *testing.T, c *apitest.Client) string {
	t.Helper()
	id, _ := c.Get("/me").Body["id"].(string)
	if id == "" {
		t.Fatal("no user id")
	}
	return id
}

func allWeek(energy int) map[string]any {
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = energy
	}
	return all
}

// homeOf is a Home of the given Residents, in joining order (a minute apart),
// each with Energy 4 and a share of the Chores, planned at 07:00 on Monday the
// 2nd. The clock is left at 09:00 the same day.
func homeOf(t *testing.T, emails ...string) (*apitest.App, []*apitest.Client) {
	t.Helper()
	app := apitest.Start(t)
	first := apitest.HomeWithResident(t, app, emails[0])
	cs := []*apitest.Client{first}
	for _, e := range emails[1:] {
		app.Clock.Advance(time.Minute) // the fake clock stands still, so joins would tie
		cs = append(cs, apitest.ExtraResident(t, app, first, e))
	}
	for _, c := range cs {
		apitest.SetBaseline(t, c, allWeek(4))
	}
	app.Clock.Set(apitest.MondayAt(6))
	for i := range 3 * len(cs) {
		apitest.CreateChore(t, first, apitest.Chore(fmt.Sprintf("Chore %d", i), 7, 2, "normal", []string{}))
	}
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	app.Clock.Set(apitest.MondayAt(9))
	return app, cs
}

func completeOne(t *testing.T, c *apitest.Client) {
	t.Helper()
	mine := apitest.MineOf(t, c)
	if len(mine) == 0 {
		t.Fatal("the Resident has no Task to complete")
	}
	apitest.MustAct(t, c, "complete", mine[0]["id"].(string))
}

func TestListNeedsATokenAndAHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	apitest.ExpectStatus(t, app.Get("/home/residents"), http.StatusUnauthorized)
	res := app.SignInAs("a@example.com").Get("/home/residents")
	if res.Status != http.StatusNotFound || res.Body["error"] != "no home" {
		t.Errorf("without a Home: %d %s, want 404 no home", res.Status, res.Raw)
	}
}

func TestListHasExactlyTheAgreedKeysAndLeaksNothingPrivate(t *testing.T) {
	t.Parallel()
	_, cs := homeOf(t, "abner@example.com", "bruna.souza@example.com")
	a, b := cs[0], cs[1]
	apitest.ExpectStatus(t, a.Put("/me/name", map[string]any{"name": "Abner"}), http.StatusOK)

	// B has every private thing a Resident can have.
	chore := apitest.CreateChore(t, b, apitest.Chore("Secret chore", 7, 2, "normal", []string{"heavy_lifting"}))
	apitest.SetPreference(t, b, chore, "dislike")
	apitest.ExpectStatus(t, b.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
	apitest.CheckIn(t, b, "drained", "bending")

	for _, c := range []*apitest.Client{a, b} {
		res := c.Get("/home/residents")
		apitest.ExpectStatus(t, res, http.StatusOK)
		wantKeys(t, "body", res.Body, "date", "residents")
		items := res.Body["residents"].([]any)
		if len(items) != 2 {
			t.Fatalf("residents = %s, want 2", res.Raw)
		}
		for _, it := range items {
			wantKeys(t, "resident", it.(map[string]any),
				"avatarTone", "doneToday", "id", "initials", "name", "photoUrl", "streak", "you")
		}
		raw := strings.ToLower(string(res.Raw))
		leaks := []string{
			"abner@", "bruna.souza@", "example.com", userID(t, a), userID(t, b),
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

func TestListShowsTheCallerFirstThenJoiningOrderNeverByStreak(t *testing.T) {
	t.Parallel()
	_, cs := homeOf(t, "a@example.com", "b@example.com", "c@example.com")
	a, b, c := cs[0], cs[1], cs[2]
	for _, x := range []struct {
		c    *apitest.Client
		name string
	}{{a, "Aline"}, {b, "Bia"}, {c, "Caio"}} {
		apitest.ExpectStatus(t, x.c.Put("/me/name", map[string]any{"name": x.name}), http.StatusOK)
	}
	completeOne(t, b) // B has the highest Streak

	for viewer, want := range map[*apitest.Client][]string{
		a: {"Aline", "Bia", "Caio"},
		b: {"Bia", "Aline", "Caio"},
		c: {"Caio", "Aline", "Bia"},
	} {
		got := listOf(t, viewer)
		if !slices.Equal(names(got), want) {
			t.Errorf("order = %v, want %v", names(got), want)
		}
		for i, r := range got.Residents {
			if r.You != (i == 0) {
				t.Errorf("you = %v at position %d, want true only for the caller", r.You, i)
			}
		}
	}
	if got := listOf(t, a).Residents[1]; got.Streak != 1 {
		t.Fatalf("setup: B's streak = %d, want 1", got.Streak)
	}
}

func TestEachStreakEqualsTheOnesOwnStreakRead(t *testing.T) {
	t.Parallel()
	_, cs := homeOf(t, "a@example.com", "b@example.com")
	a, b := cs[0], cs[1]
	completeOne(t, a)

	for _, viewer := range cs {
		got := listOf(t, viewer)
		for _, r := range got.Residents {
			owner := b
			if r.Name == "a" {
				owner = a
			}
			if want := streakOf(t, owner); r.Streak != want {
				t.Errorf("%s: streak %d, GET /home/streak says %d", r.Name, r.Streak, want)
			}
		}
	}
	if got := listOf(t, a).Residents; got[0].Streak != 1 || got[1].Streak != 0 {
		t.Errorf("streaks = %d, %d; want 1 and 0 so the parity check tells them apart", got[0].Streak, got[1].Streak)
	}
}

func TestATwoPersonCompletionCountsForBothAndOthersCountOwnTasks(t *testing.T) {
	t.Parallel()
	app, a, b := apitest.DuoHome(t, 4, 4)
	app.Clock.Set(apitest.MondayAt(9))
	task := apitest.MineOf(t, a)[0]["id"].(string)
	apitest.MustAct(t, a, "accept", task)
	apitest.MustAct(t, b, "accept", task)
	apitest.MustAct(t, b, "complete", task)

	for _, viewer := range []*apitest.Client{a, b} {
		for _, r := range listOf(t, viewer).Residents {
			if r.DoneToday != 1 {
				t.Errorf("%s doneToday = %d, want 1 for the shared Completion", r.Name, r.DoneToday)
			}
		}
	}
}

func TestACompletionBeforeLocalMidnightIsStillTodayInANonUTCHome(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("UTC", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	// Sao Paulo is UTC-3 all year. Set before any Chore exists.
	apitest.ExpectStatus(t, me.Put("/home", apitest.HomeBody("America/Sao_Paulo", "07:00")), http.StatusOK)
	apitest.SetBaseline(t, me, allWeek(4))
	app.Clock.Set(apitest.MondayAt(9)) // 06:00 local
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 7, 2, "normal", []string{}))
	app.Clock.Set(apitest.MondayAt(10)) // 07:00 local
	app.RunAllocation(t)

	// 02:30 UTC on Tuesday is 23:30 on Monday at home.
	app.Clock.Set(time.Date(2026, time.March, 3, 2, 30, 0, 0, time.UTC))
	apitest.MustAct(t, me, "complete", apitest.MineOf(t, me)[0]["id"].(string))

	app.Clock.Set(time.Date(2026, time.March, 3, 2, 45, 0, 0, time.UTC))
	got := listOf(t, me)
	if got.Date != "2026-03-02" || got.Residents[0].DoneToday != 1 {
		t.Errorf("at 23:45 local: date %s doneToday %d, want 2026-03-02 and 1", got.Date, got.Residents[0].DoneToday)
	}

	app.Clock.Set(time.Date(2026, time.March, 3, 10, 0, 0, 0, time.UTC))
	got = listOf(t, me)
	if got.Date != "2026-03-03" || got.Residents[0].DoneToday != 0 {
		t.Errorf("next local day: date %s doneToday %d, want 2026-03-03 and 0", got.Date, got.Residents[0].DoneToday)
	}
}

func TestANewResidentWithNoHistoryHasZeroStreakAndZeroDoneToday(t *testing.T) {
	t.Parallel()
	app, cs := homeOf(t, "a@example.com")
	completeOne(t, cs[0])
	apitest.ExtraResident(t, app, cs[0], "new@example.com")

	got := listOf(t, cs[0])
	if len(got.Residents) != 2 {
		t.Fatalf("residents = %v, want 2", names(got))
	}
	if r := got.Residents[1]; r.Name != "new" || r.Streak != 0 || r.DoneToday != 0 {
		t.Errorf("new Resident = %+v, want streak 0 and doneToday 0", r)
	}
	if r := got.Residents[0]; r.DoneToday != 1 {
		t.Errorf("A doneToday = %d, want 1", r.DoneToday)
	}
}

func TestAResidentWhoLeftAndAnotherHomesResidentsAreNotListed(t *testing.T) {
	t.Parallel()
	app, cs := homeOf(t, "a@example.com", "b@example.com")
	other := apitest.HomeWithResident(t, app, "other@example.com")
	apitest.ExpectStatus(t, other.Put("/me/name", map[string]any{"name": "Elsewhere"}), http.StatusOK)

	if got := listOf(t, cs[0]); !slices.Equal(names(got), []string{"a", "b"}) {
		t.Fatalf("names = %v, want a, b (not Elsewhere)", names(got))
	}
	apitest.ExpectStatus(t, apitest.LeaveHome(cs[1]), http.StatusNoContent)
	if got := listOf(t, cs[0]); !slices.Equal(names(got), []string{"a"}) {
		t.Errorf("after B left: names = %v, want a", names(got))
	}
}

func TestANamelessUserShowsTheEmailsLocalPartAndNeverTheEmail(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "maria.silva@example.com")

	got := listOf(t, a)
	r := got.Residents[0]
	if r.Name != "maria.silva" || r.Initials != "MS" {
		t.Errorf("resident = %+v, want name maria.silva and initials MS", r)
	}
	if r.AvatarTone == "" || r.AvatarTone == "other" {
		t.Errorf("avatarTone = %q, want a pastel Category id", r.AvatarTone)
	}
	if r.PhotoURL != nil {
		t.Errorf("photoUrl = %v, want null", r.PhotoURL)
	}
	if strings.Contains(got.Raw, "@example.com") || strings.Contains(got.Raw, "@") {
		t.Errorf("body %s contains the email", got.Raw)
	}
}

func TestTheAvatarFallbackAgreesWithMe(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "ana.souza@example.com")

	me := a.Get("/me")
	r := listOf(t, a).Residents[0]
	if me.Body["initials"] != r.Initials || me.Body["avatarTone"] != r.AvatarTone {
		t.Errorf("/me says %v %v, the list says %s %s", me.Body["initials"], me.Body["avatarTone"], r.Initials, r.AvatarTone)
	}
}

func TestTheNumberOfQueriesDoesNotGrowWithTheNumberOfResidents(t *testing.T) {
	t.Parallel()
	count := func(emails ...string) int {
		app, cs := homeOf(t, emails...)
		for _, c := range cs {
			completeOne(t, c)
		}
		if n := len(listOf(t, cs[0]).Residents); n != len(emails) {
			t.Fatalf("residents = %d, want %d", n, len(emails))
		}
		return app.QueriesFor(func() { listOf(t, cs[0]) })
	}
	two := count("a@example.com", "b@example.com")
	five := count("a@example.com", "b@example.com", "c@example.com", "d@example.com", "e@example.com")
	if two == 0 || two != five {
		t.Errorf("queries: %d with 2 Residents, %d with 5; want the same non-zero number", two, five)
	}
}
