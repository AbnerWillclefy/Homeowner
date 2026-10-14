package dayplan_test

import (
	"net/http"
	"sync"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func TestTwoSimultaneousCompletesGiveOneCompletion(t *testing.T) {
	t.Parallel()
	app, a, _ := apitest.TwoResidents(t)
	id := apitest.MineOf(t, a)[0]["id"].(string)

	const n = 6
	statuses := make([]int, n)
	codes := make([]any, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := apitest.Act(a, "complete", id)
			statuses[i], codes[i] = r.Status, r.Body["error"]
		}()
	}
	wg.Wait()

	ok, conflicts := 0, 0
	for i, s := range statuses {
		switch {
		case s == http.StatusOK:
			ok++
		case s == http.StatusConflict && codes[i] == "already_done":
			conflicts++
		default:
			t.Errorf("complete %d = %d %v", i, s, codes[i])
		}
	}
	if ok != 1 || conflicts != n-1 {
		t.Fatalf("%d OK and %d already_done, want 1 and %d", ok, conflicts, n-1)
	}
	if got := apitest.Count(t, app, `SELECT count(*) FROM completions WHERE task_id = $1`, id); got != 1 {
		t.Fatalf("%d completions, want 1", got)
	}
}

func TestAnAcceptRacingACheckInLeavesTheTaskCommittedAndMine(t *testing.T) {
	t.Parallel()
	_, a, _ := apitest.TwoResidents(t)
	task := apitest.MineOf(t, a)[0]
	id := task["id"].(string)

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			if r := apitest.Act(a, "accept", id); r.Status != http.StatusOK {
				t.Errorf("accept = %d %s", r.Status, r.Raw)
			}
		}()
		go func() {
			defer wg.Done()
			if r := a.Put("/home/check-in", map[string]any{"level": "normal"}); r.Status != http.StatusOK {
				t.Errorf("check-in = %d %s", r.Status, r.Raw)
			}
		}()
	}
	wg.Wait()

	if committedOf(apitest.MineOf(t, a), task["choreName"].(string)) != true {
		t.Fatalf("the accepted Task is not committed in mine: %s", apitest.DayPlan(t, a).Raw)
	}
}
