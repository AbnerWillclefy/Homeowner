package dayplan_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// A Chore both Residents dislike goes to whoever did it least recently, so it
// alternates between them over consecutive Allocations, and the Day Plan shows
// why.
func TestAChoreTwoResidentsDislikeAlternatesBetweenThem(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		apitest.SetBaseline(t, c, map[string]any{"monday": 5, "tuesday": 5, "wednesday": 5})
	}
	app.Clock.Set(apitest.MondayAt(6))
	scrub := apitest.CreateChore(t, a, apitest.Chore("Scrub", 1, 2, "normal", []string{}))
	apitest.SetPreference(t, a, scrub, "dislike")
	apitest.SetPreference(t, b, scrub, "dislike")

	// Monday: nobody has done it, so it falls to the usual order.
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	first, second := a, b
	if len(apitest.MineOf(t, a)) == 0 {
		first, second = b, a
	}
	monday := apitest.MineOf(t, first)
	if len(monday) != 1 || len(apitest.MineOf(t, second)) != 0 || monday[0]["reason"] != "deadline_today" {
		t.Fatalf("Monday: first has %v, second has %v", monday, apitest.MineOf(t, second))
	}
	apitest.MustAct(t, first, "complete", monday[0]["id"].(string))

	// Tuesday: the one who did it has more Energy, so only turn-taking can
	// give it to the other.
	apitest.SetBaseline(t, second, map[string]any{"tuesday": 3, "wednesday": 5})
	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	tuesday := apitest.MineOf(t, second)
	if len(tuesday) != 1 || len(apitest.MineOf(t, first)) != 0 || tuesday[0]["reason"] != "turn_taking" {
		t.Fatalf("Tuesday: second has %v, first has %v", tuesday, apitest.MineOf(t, first))
	}
	apitest.MustAct(t, second, "complete", tuesday[0]["id"].(string))

	// Wednesday: it is the first one's turn again.
	apitest.SetBaseline(t, second, map[string]any{"wednesday": 5})
	apitest.SetBaseline(t, first, map[string]any{"wednesday": 3})
	app.Clock.Set(apitest.MondayAt(7).AddDate(0, 0, 2))
	app.RunAllocation(t)
	wednesday := apitest.MineOf(t, first)
	if len(wednesday) != 1 || len(apitest.MineOf(t, second)) != 0 || wednesday[0]["reason"] != "turn_taking" {
		t.Fatalf("Wednesday: first has %v, second has %v", wednesday, apitest.MineOf(t, second))
	}

	// A Check-in re-plans one Resident, who is then the only candidate: there
	// is no choice left to explain, so the urgency reason comes back.
	apitest.CheckIn(t, first, "energized")
	if got := apitest.MineOf(t, first); len(got) != 1 || got[0]["reason"] != "deadline_today" {
		t.Fatalf("after the Check-in: %v", got)
	}
}
