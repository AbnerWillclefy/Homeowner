package server_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// A Chore both Residents dislike goes to whoever did it least recently, so it
// alternates between them over consecutive Allocations, and the Day Plan shows
// why.
func TestAChoreTwoResidentsDislikeAlternatesBetweenThem(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := homeWithResident(t, app, "a@example.com")
	b := extraResident(t, app, a, "b@example.com")
	for _, c := range []*apitest.Client{a, b} {
		setBaseline(t, c, map[string]any{"monday": 5, "tuesday": 5, "wednesday": 5})
	}
	app.Clock.Set(mondayAt(6))
	scrub := createChore(t, a, chore("Scrub", 1, 2, "normal", []string{}))
	setPref(t, a, scrub, "dislike")
	setPref(t, b, scrub, "dislike")

	// Monday: nobody has done it, so it falls to the usual order.
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	first, second := a, b
	if len(mineOf(t, a)) == 0 {
		first, second = b, a
	}
	monday := mineOf(t, first)
	if len(monday) != 1 || len(mineOf(t, second)) != 0 || monday[0]["reason"] != "deadline_today" {
		t.Fatalf("Monday: first has %v, second has %v", monday, mineOf(t, second))
	}
	mustAct(t, first, "complete", monday[0]["id"].(string))

	// Tuesday: the one who did it has more Energy, so only turn-taking can
	// give it to the other.
	setBaseline(t, second, map[string]any{"tuesday": 3, "wednesday": 5})
	app.Clock.Set(mondayAt(7).AddDate(0, 0, 1))
	app.RunAllocation(t)
	tuesday := mineOf(t, second)
	if len(tuesday) != 1 || len(mineOf(t, first)) != 0 || tuesday[0]["reason"] != "turn_taking" {
		t.Fatalf("Tuesday: second has %v, first has %v", tuesday, mineOf(t, first))
	}
	mustAct(t, second, "complete", tuesday[0]["id"].(string))

	// Wednesday: it is the first one's turn again.
	setBaseline(t, second, map[string]any{"wednesday": 5})
	setBaseline(t, first, map[string]any{"wednesday": 3})
	app.Clock.Set(mondayAt(7).AddDate(0, 0, 2))
	app.RunAllocation(t)
	wednesday := mineOf(t, first)
	if len(wednesday) != 1 || len(mineOf(t, second)) != 0 || wednesday[0]["reason"] != "turn_taking" {
		t.Fatalf("Wednesday: first has %v, second has %v", wednesday, mineOf(t, second))
	}

	// A Check-in re-plans one Resident, who is then the only candidate: there
	// is no choice left to explain, so the urgency reason comes back.
	checkIn(t, first, "energized")
	if got := mineOf(t, first); len(got) != 1 || got[0]["reason"] != "deadline_today" {
		t.Fatalf("after the Check-in: %v", got)
	}
}
