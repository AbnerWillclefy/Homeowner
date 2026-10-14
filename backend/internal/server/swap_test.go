package server_test

import (
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// offer posts a Swap offer: the caller gives offered for requested.
func offer(c *apitest.Client, offered, requested string) apitest.Response {
	return c.Post("/home/swaps", map[string]any{"offeredTaskId": offered, "requestedTaskId": requested})
}

func mustOffer(t *testing.T, c *apitest.Client, offered, requested string) apitest.Response {
	t.Helper()
	r := offer(c, offered, requested)
	if r.Status != http.StatusOK {
		t.Fatalf("POST /home/swaps = %d %s", r.Status, r.Raw)
	}
	return r
}

func swapAct(c *apitest.Client, id, action string) apitest.Response {
	return c.Post("/home/swaps/"+id+"/"+action, nil)
}

func mustSwapAct(t *testing.T, c *apitest.Client, id, action string) apitest.Response {
	t.Helper()
	r := swapAct(c, id, action)
	if r.Status != http.StatusOK {
		t.Fatalf("POST swap %s %s = %d %s", id, action, r.Status, r.Raw)
	}
	return r
}

func wantSwapError(t *testing.T, r apitest.Response, status int, code string) {
	t.Helper()
	if r.Status != status || r.Body["error"] != code {
		t.Fatalf("got %d %s, want %d %s", r.Status, r.Raw, status, code)
	}
}

// swapsOf are the live offers the caller sees: "incoming" or "outgoing".
func swapsOf(t *testing.T, c *apitest.Client, side string) []map[string]any {
	t.Helper()
	sw, ok := dayPlan(t, c).Body["swaps"].(map[string]any)
	if !ok {
		t.Fatalf("no swaps in the Day Plan: %s", dayPlan(t, c).Raw)
	}
	return taskList(t, sw[side])
}

// swapPair is A's first Task and B's first Task, and the ids of both.
type swapPair struct{ a, b, aName, bName string }

func pairOf(t *testing.T, a, b *apitest.Client) swapPair {
	t.Helper()
	ta, tb := mineOf(t, a)[0], mineOf(t, b)[0]
	return swapPair{a: ta["id"].(string), b: tb["id"].(string), aName: ta["choreName"].(string), bName: tb["choreName"].(string)}
}

func commitments(t *testing.T, app *apitest.App, task string) int {
	t.Helper()
	return count(t, app, `SELECT count(*) FROM task_residents WHERE task_id = $1 AND committed_on = '2026-03-02'`, task)
}

func TestAnAcceptedSwapExchangesTheTasksAndCommitsBoth(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	p := pairOf(t, a, b)

	r := mustOffer(t, a, p.a, p.b)
	if len(taskList(t, r.Body["mine"])) != 2 || mineOf(t, a)[0]["id"] != p.a {
		t.Fatalf("an offer moves nothing: %s", r.Raw)
	}
	out := swapsOf(t, a, "outgoing")
	in := swapsOf(t, b, "incoming")
	if len(out) != 1 || len(in) != 1 || out[0]["id"] != in[0]["id"] {
		t.Fatalf("offer not visible to both sides: %v %v", out, in)
	}
	if len(swapsOf(t, a, "incoming")) != 0 || len(swapsOf(t, b, "outgoing")) != 0 {
		t.Fatal("an offer shows on the wrong side")
	}

	r = mustSwapAct(t, b, in[0]["id"].(string), "accept")
	mineB := taskList(t, r.Body["mine"])
	if committedOf(mineB, p.aName) != true || reasonOf(mineB, p.aName) != "swapped" || committedOf(mineB, p.bName) != "missing" {
		t.Fatalf("B after the swap: %s", r.Raw)
	}
	mineA := mineOf(t, a)
	if committedOf(mineA, p.bName) != true || reasonOf(mineA, p.bName) != "swapped" || committedOf(mineA, p.aName) != "missing" {
		t.Fatalf("A after the swap: %s", dayPlan(t, a).Raw)
	}
	for _, task := range []string{p.a, p.b} {
		if got := commitments(t, app, task); got != 1 {
			t.Fatalf("%d commitments on %s, want 1", got, task)
		}
	}
	if got := count(t, app, `SELECT count(*) FROM task_residents tr JOIN residents r ON r.id = tr.resident_id
		JOIN users u ON u.id = r.user_id WHERE tr.task_id = $1 AND u.email = 'b@example.com'`, p.a); got != 1 {
		t.Fatalf("X is not committed by B: %d", got)
	}
	if len(swapsOf(t, a, "outgoing")) != 0 || len(swapsOf(t, b, "incoming")) != 0 {
		t.Fatal("an answered offer is still listed")
	}
	if got := count(t, app, `SELECT count(*) FROM swap_offers WHERE status = 'accepted'`); got != 1 {
		t.Fatalf("%d accepted offers, want 1", got)
	}
}

func TestADeclinedSwapChangesNothing(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	p := pairOf(t, a, b)
	mustAct(t, a, "accept", p.a)
	before := string(dayPlan(t, b).Raw)

	mustOffer(t, a, p.a, p.b)
	id := swapsOf(t, b, "incoming")[0]["id"].(string)
	mustSwapAct(t, b, id, "decline")

	if len(swapsOf(t, a, "outgoing")) != 0 || len(swapsOf(t, b, "incoming")) != 0 {
		t.Fatal("a declined offer is still listed")
	}
	if string(dayPlan(t, b).Raw) != before {
		t.Fatalf("a decline moved something:\n%s\n%s", before, dayPlan(t, b).Raw)
	}
	if commitments(t, app, p.a) != 1 || commitments(t, app, p.b) != 0 {
		t.Fatal("a decline changed the Commitments")
	}
	wantSwapError(t, swapAct(b, id, "accept"), http.StatusConflict, "swap_closed")
}

func TestAcceptingASwapEndsTheOffererCommitmentOnTheTaskGivenAway(t *testing.T) {
	t.Parallel()
	app, a, b := twoResidents(t)
	p := pairOf(t, a, b)
	mustAct(t, a, "accept", p.a)

	mustOffer(t, a, p.a, p.b)
	mustSwapAct(t, b, swapsOf(t, b, "incoming")[0]["id"].(string), "accept")

	if got := count(t, app, `SELECT count(*) FROM task_residents tr JOIN residents r ON r.id = tr.resident_id
		JOIN users u ON u.id = r.user_id WHERE tr.task_id = $1 AND u.email = 'a@example.com'`, p.a); got != 0 {
		t.Fatalf("A still has a Commitment on the Task they gave away")
	}
}
