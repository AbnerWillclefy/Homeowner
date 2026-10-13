package server_test

import (
	"net/http"
	"sync"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

// swapHome is twoResidents with every Chore carrying the given Demands.
func swapHome(t *testing.T, demands ...string) (app *apitest.App, a, b *apitest.Client) {
	t.Helper()
	app = apitest.Start(t)
	a = homeWithResident(t, app, "a@example.com")
	b = extraResident(t, app, a, "b@example.com")
	setBaseline(t, a, map[string]any{"monday": 4, "tuesday": 4})
	setBaseline(t, b, map[string]any{"monday": 4, "tuesday": 4})
	app.Clock.Set(mondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		createChore(t, a, chore(n, 7, 2, "normal", append([]string{}, demands...)))
	}
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	if len(mineOf(t, a)) != 2 || len(mineOf(t, b)) != 2 {
		t.Fatalf("setup: %s", dayPlan(t, a).Raw)
	}
	return app, a, b
}

func noOffers(t *testing.T, c *apitest.Client) {
	t.Helper()
	if len(swapsOf(t, c, "incoming")) != 0 || len(swapsOf(t, c, "outgoing")) != 0 {
		t.Fatalf("unexpected offers: %s", dayPlan(t, c).Raw)
	}
}

func offerCount(t *testing.T, app *apitest.App) int {
	t.Helper()
	return count(t, app, `SELECT count(*) FROM swap_offers`)
}

func TestASwapThatBreaksARestrictionIsRejectedAtTheOffer(t *testing.T) {
	t.Parallel()
	t.Run("A cannot do a Demand of B's Task", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t, "heavy_lifting")
		p := pairOf(t, a, b)
		expectStatus(t, a.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
		wantConflict(t, offer(a, p.a, p.b), "restricted")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
	t.Run("B cannot do a Demand of A's Task", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t, "heavy_lifting")
		p := pairOf(t, a, b)
		expectStatus(t, b.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
		wantConflict(t, offer(a, p.a, p.b), "restricted")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
	t.Run("A is restricted from B's Chore", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t)
		p := pairOf(t, a, b)
		choreID := mineOf(t, b)[0]["choreId"].(string)
		expectStatus(t, a.Put("/home/chores/"+choreID+"/restriction", nil), http.StatusNoContent)
		wantConflict(t, offer(a, p.a, p.b), "restricted")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
	t.Run("B is restricted from A's Chore", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t)
		p := pairOf(t, a, b)
		choreID := mineOf(t, a)[0]["choreId"].(string)
		expectStatus(t, b.Put("/home/chores/"+choreID+"/restriction", nil), http.StatusNoContent)
		wantConflict(t, offer(a, p.a, p.b), "restricted")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
}

func TestARestrictionAfterTheOfferStopsTheAcceptAndLeavesTheOfferPending(t *testing.T) {
	t.Parallel()
	app, a, b := swapHome(t, "heavy_lifting")
	p := pairOf(t, a, b)
	mustAct(t, b, "accept", p.b) // committed, so B's Check-in keeps it
	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, b, "incoming")[0]["id"].(string)

	checkIn(t, b, "normal", "heavy_lifting")
	wantConflict(t, swapAct(b, id, "accept"), "restricted")
	if mineOf(t, b)[0]["id"] != p.b || commitments(t, app, p.a) != 0 {
		t.Fatalf("the Tasks moved: %s", dayPlan(t, b).Raw)
	}
	if len(swapsOf(t, b, "incoming")) != 1 {
		t.Fatal("the offer is no longer pending")
	}
	mustSwapAct(t, b, id, "decline")
}

func TestOnlyTheRecipientAnswersAndOnlyTheOffererCancels(t *testing.T) {
	t.Parallel()
	app, a, b := swapHome(t)
	p := pairOf(t, a, b)
	c := homeWithResident(t, app, "c@example.com") // another Home
	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, a, "outgoing")[0]["id"].(string)

	for _, who := range []struct {
		name string
		c    *apitest.Client
		do   string
	}{
		{"offerer accepts", a, "accept"}, {"offerer declines", a, "decline"},
		{"recipient cancels", b, "cancel"},
		{"outsider accepts", c, "accept"}, {"outsider declines", c, "decline"}, {"outsider cancels", c, "cancel"},
	} {
		if r := swapAct(who.c, id, who.do); r.Status != http.StatusNotFound || r.Body["error"] != "swap_not_found" {
			t.Fatalf("%s: %d %s", who.name, r.Status, r.Raw)
		}
	}
	for _, bad := range []string{"not-an-id", "00000000-0000-0000-0000-000000000000"} {
		if r := swapAct(b, bad, "accept"); r.Status != http.StatusNotFound || r.Body["error"] != "swap_not_found" {
			t.Fatalf("id %q: %d %s", bad, r.Status, r.Raw)
		}
	}
	if len(swapsOf(t, b, "incoming")) != 1 {
		t.Fatal("a refused answer changed the offer")
	}
	r := mustSwapAct(t, a, id, "cancel")
	if len(taskList(t, r.Body["mine"])) != 2 {
		t.Fatalf("a cancel moved something: %s", r.Raw)
	}
	noOffers(t, a)
	noOffers(t, b)
	wantConflict(t, swapAct(b, id, "accept"), "swap_closed")
}

func TestAnOfferNeedsTasksThatCanBeSwapped(t *testing.T) {
	t.Parallel()
	t.Run("before the Allocation", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		a := homeWithResident(t, app, "a@example.com")
		app.Clock.Set(mondayAt(6))
		createChore(t, a, chore("One", 7, 2, "normal", []string{}))
		createChore(t, a, chore("Two", 7, 2, "normal", []string{}))
		ids := pool(t, a)
		wantConflict(t, offer(a, ids[0]["id"].(string), ids[1]["id"].(string)), "no_plan_today")
	})
	t.Run("the offered Task is not the caller's", func(t *testing.T) {
		t.Parallel()
		_, a, b := swapHome(t)
		p := pairOf(t, a, b)
		wantConflict(t, offer(a, p.b, p.a), "not_yours")
		poolID := taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)
		wantConflict(t, offer(a, poolID, p.b), "not_yours")
	})
	t.Run("the requested Task is the caller's or in the pool", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t)
		p := pairOf(t, a, b)
		own := mineOf(t, a)[1]["id"].(string)
		wantConflict(t, offer(a, p.a, own), "not_held_by_other")
		poolID := taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)
		wantConflict(t, offer(a, p.a, poolID), "not_held_by_other")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
	t.Run("a Task is done", func(t *testing.T) {
		t.Parallel()
		_, a, b := swapHome(t)
		p := pairOf(t, a, b)
		mustAct(t, b, "complete", p.b)
		wantConflict(t, offer(a, p.a, p.b), "already_done")
		other := mineOf(t, b)[0]["id"].(string)
		mustAct(t, a, "complete", p.a)
		wantConflict(t, offer(a, p.a, other), "already_done")
	})
	t.Run("a two-person Task", func(t *testing.T) {
		t.Parallel()
		app := apitest.Start(t)
		a := homeWithResident(t, app, "a@example.com")
		setBaseline(t, a, map[string]any{"monday": 4})
		app.Clock.Set(mondayAt(6))
		createChore(t, a, chore("One", 7, 2, "normal", []string{}))
		two := chore("Move bed", 7, 2, "normal", []string{})
		two["people"] = 2
		createChore(t, a, two)
		app.Clock.Set(mondayAt(7))
		app.RunAllocation(t)
		bed := taskList(t, dayPlan(t, a).Body["pool"])[0]["id"].(string)
		one := mineOf(t, a)[0]["id"].(string)
		wantConflict(t, offer(a, one, bed), "two_person_task")
		wantConflict(t, offer(a, bed, one), "two_person_task")
	})
	t.Run("the same offer twice", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t)
		p := pairOf(t, a, b)
		mustOffer(t, a, p.a, p.b)
		wantConflict(t, offer(a, p.a, p.b), "swap_pending")
		if got := offerCount(t, app); got != 1 {
			t.Fatalf("%d offers, want 1", got)
		}
	})
	t.Run("malformed or unknown ids or fields", func(t *testing.T) {
		t.Parallel()
		_, a, b := swapHome(t)
		p := pairOf(t, a, b)
		if r := offer(a, "nope", p.b); r.Status != http.StatusNotFound {
			t.Fatalf("malformed id: %d %s", r.Status, r.Raw)
		}
		if r := offer(a, p.a, "00000000-0000-0000-0000-000000000000"); r.Status != http.StatusNotFound {
			t.Fatalf("unknown id: %d %s", r.Status, r.Raw)
		}
		r := a.Post("/home/swaps", map[string]any{"offeredTaskId": p.a, "requestedTaskId": p.b, "residentId": "x"})
		expectStatus(t, r, http.StatusBadRequest)
	})
}

func TestADrainedResidentIsNotOfferedASwap(t *testing.T) {
	t.Parallel()
	t.Run("the recipient is drained", func(t *testing.T) {
		t.Parallel()
		app, a, b := swapHome(t)
		p := pairOf(t, a, b)
		mustAct(t, b, "accept", p.b) // committed, so the Check-in keeps it
		checkIn(t, b, "drained")
		wantConflict(t, offer(a, p.a, p.b), "recipient_drained")
		if got := offerCount(t, app); got != 0 {
			t.Fatalf("%d offers stored", got)
		}
	})
	t.Run("the offerer is drained", func(t *testing.T) {
		t.Parallel()
		_, a, b := swapHome(t)
		p := pairOf(t, a, b)
		mustAct(t, a, "accept", p.a)
		checkIn(t, a, "drained")
		wantConflict(t, offer(a, p.a, p.b), "recipient_drained")
	})
	t.Run("the recipient checks in drained before answering", func(t *testing.T) {
		t.Parallel()
		_, a, b := swapHome(t)
		p := pairOf(t, a, b)
		mustAct(t, b, "accept", p.b)
		mustOffer(t, a, p.a, p.b)
		id := swapsOf(t, b, "incoming")[0]["id"].(string)
		checkIn(t, b, "drained")
		wantConflict(t, swapAct(b, id, "accept"), "recipient_drained")
	})
}

func TestAStaleOfferIsHiddenAndCannotBeAccepted(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		do   func(t *testing.T, a, b *apitest.Client, p swapPair)
	}{
		{"the offerer refuses the offered Task", func(t *testing.T, a, b *apitest.Client, p swapPair) { mustAct(t, a, "refuse", p.a) }},
		{"the offerer completes the offered Task", func(t *testing.T, a, b *apitest.Client, p swapPair) { mustAct(t, a, "complete", p.a) }},
		{"the recipient completes the requested Task", func(t *testing.T, a, b *apitest.Client, p swapPair) { mustAct(t, b, "complete", p.b) }},
		{"the recipient refuses the requested Task", func(t *testing.T, a, b *apitest.Client, p swapPair) { mustAct(t, b, "refuse", p.b) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app, a, b := swapHome(t)
			p := pairOf(t, a, b)
			mustOffer(t, a, p.a, p.b)
			id := swapsOf(t, b, "incoming")[0]["id"].(string)
			tc.do(t, a, b, p)
			noOffers(t, a)
			noOffers(t, b)
			before := string(dayPlan(t, b).Raw)
			wantConflict(t, swapAct(b, id, "accept"), "swap_stale")
			if string(dayPlan(t, b).Raw) != before || commitments(t, app, p.a)+commitments(t, app, p.b) != 0 {
				t.Fatal("a stale accept changed something")
			}
		})
	}
}

func TestAcceptingASwapCancelsTheOtherOffersOnItsTasks(t *testing.T) {
	t.Parallel()
	app, a, b := swapHome(t)
	p := pairOf(t, a, b)
	y2 := mineOf(t, b)[1]["id"].(string)
	mustOffer(t, a, p.a, p.b)
	mustOffer(t, a, p.a, y2)
	mustOffer(t, b, p.b, p.a) // the reverse offer also mentions both Tasks
	var first string
	for _, o := range swapsOf(t, b, "incoming") {
		if o["requested"].(map[string]any)["id"] == p.b {
			first = o["id"].(string)
		}
	}
	if first == "" {
		t.Fatalf("setup: %s", dayPlan(t, b).Raw)
	}
	mustSwapAct(t, b, first, "accept")
	if got := count(t, app, `SELECT count(*) FROM swap_offers WHERE status = 'pending'`); got != 0 {
		t.Fatalf("%d offers still pending", got)
	}
	noOffers(t, a)
	noOffers(t, b)
	wantConflict(t, swapAct(b, first, "accept"), "swap_closed")
}

func TestAnOfferIsGoneTheNextDay(t *testing.T) {
	t.Parallel()
	app, a, b := swapHome(t)
	p := pairOf(t, a, b)
	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, b, "incoming")[0]["id"].(string)

	atDay(app, 3) // Tuesday
	noOffers(t, b)
	app.RunAllocation(t)
	noOffers(t, b)
	if r := swapAct(b, id, "accept"); r.Status != http.StatusNotFound || r.Body["error"] != "swap_not_found" {
		t.Fatalf("accepting yesterday's offer: %d %s", r.Status, r.Raw)
	}
}

func TestASwapSurvivesReplans(t *testing.T) {
	t.Parallel()
	_, a, b := swapHome(t)
	p := pairOf(t, a, b)
	mustAct(t, b, "accept", p.b)
	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, b, "incoming")[0]["id"].(string)

	// B's Check-in re-plans B, whose Task is Committed: the offer stands.
	checkIn(t, b, "normal")
	if len(swapsOf(t, b, "incoming")) != 1 {
		t.Fatalf("a re-plan broke the offer: %s", dayPlan(t, b).Raw)
	}
	mustSwapAct(t, b, id, "accept")

	// Both Tasks are Committed now, so a re-plan of either keeps them.
	checkIn(t, a, "normal")
	checkIn(t, b, "normal")
	if committedOf(mineOf(t, a), p.bName) != true || committedOf(mineOf(t, b), p.aName) != true {
		t.Fatalf("a re-plan lost the swapped Tasks: %s / %s", dayPlan(t, a).Raw, dayPlan(t, b).Raw)
	}
}

func TestTwoSimultaneousAcceptsOfASwapGiveOneSwap(t *testing.T) {
	t.Parallel()
	app, a, b := swapHome(t)
	p := pairOf(t, a, b)
	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, b, "incoming")[0]["id"].(string)

	const n = 6
	statuses := make([]int, n)
	codes := make([]any, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := swapAct(b, id, "accept")
			statuses[i], codes[i] = r.Status, r.Body["error"]
		}()
	}
	wg.Wait()
	ok, closed := 0, 0
	for i, s := range statuses {
		switch {
		case s == http.StatusOK:
			ok++
		case s == http.StatusConflict && codes[i] == "swap_closed":
			closed++
		default:
			t.Errorf("accept %d = %d %v", i, s, codes[i])
		}
	}
	if ok != 1 || closed != n-1 {
		t.Fatalf("%d OK and %d swap_closed, want 1 and %d", ok, closed, n-1)
	}
	for _, task := range []string{p.a, p.b} {
		if got := commitments(t, app, task); got != 1 {
			t.Fatalf("%d commitments on %s, want 1", got, task)
		}
	}
}
