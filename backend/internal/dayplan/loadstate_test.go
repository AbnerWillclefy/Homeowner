package dayplan_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

func put(t *testing.T, c *apitest.Client, path string, body map[string]any) {
	t.Helper()
	if r := c.Put(path, body); r.Status != http.StatusNoContent {
		t.Fatalf("PUT %s = %d %s", path, r.Status, r.Raw)
	}
}

func newChore(t *testing.T, c *apitest.Client, name, category string, people int) string {
	t.Helper()
	r := c.Post("/home/chores", map[string]any{
		"name": name, "category": category, "demands": []string{}, "baseEffort": 1,
		"importance": "normal", "people": people, "intervalDays": 1,
		"allowedWeekdays": []int{}, "buildsUp": false,
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("POST /home/chores = %d %s", r.Status, r.Raw)
	}
	return r.Body["id"].(string)
}

// completeToday completes the Chore's open Task from c's day plan.
func completeToday(t *testing.T, c *apitest.Client, choreName string) {
	t.Helper()
	r := c.Get("/home/day-plan")
	mine, _ := r.Body["mine"].([]any)
	for _, m := range mine {
		task := m.(map[string]any)
		if task["choreName"] == choreName {
			if r := c.Post("/home/tasks/"+task["id"].(string)+"/complete", nil); r.Status != http.StatusOK {
				t.Fatalf("complete %s = %d %s", choreName, r.Status, r.Raw)
			}
			return
		}
	}
	t.Fatalf("no Task %q in %s", choreName, r.Raw)
}

func residentID(t *testing.T, app *apitest.App, email string) string {
	t.Helper()
	var id string
	err := app.DB.QueryRow(context.Background(),
		`SELECT r.id FROM residents r JOIN users u ON u.id = r.user_id WHERE u.email = $1`, email).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func homeIDOf(t *testing.T, c *apitest.Client) string {
	t.Helper()
	return c.Get("/home").Body["id"].(string)
}

func loadStateAt(t *testing.T, app *apitest.App, homeID string, today allocation.Date) allocation.State {
	t.Helper()
	ctx := context.Background()
	tx, err := app.DB.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	s, err := dayplan.LoadState(ctx, tx, homeID, today)
	if err != nil {
		t.Fatalf("loadState: %v", err)
	}
	return s
}

func residentOf(t *testing.T, s allocation.State, id string) allocation.Resident {
	t.Helper()
	for _, r := range s.Residents {
		if r.ID == id {
			return r
		}
	}
	t.Fatalf("no Resident %s in state", id)
	return allocation.Resident{}
}

func TestLoadStateGivesResolvedPreferencesAndLastCompletions(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := newHome(t, app, "a@example.com", "UTC", "07:00")
	b := app.SignInAs("b@example.com")
	b.JoinHome(t, homeIDOf(t, a))
	for _, c := range []*apitest.Client{a, b} {
		put(t, c, "/me/baseline", map[string]any{"monday": 5, "tuesday": 5})
	}
	// A dislikes the whole bathroom Category and likes nothing else.
	put(t, a, "/me/preferences/bathroom", map[string]any{"preference": "dislike"})

	app.Clock.Set(utc(2, 6, 0)) // Monday, before the plan
	tub := newChore(t, a, "Tub", "bathroom", 2)
	mop := newChore(t, a, "Mop", "bathroom", 1)
	newChore(t, a, "Sink", "kitchen", 1)
	put(t, a, "/home/chores/"+tub+"/preference", map[string]any{"preference": "neutral"}) // beats the general dislike
	put(t, b, "/home/chores/"+mop+"/preference", map[string]any{"preference": "like"})

	// A second Home whose Completions must not leak in.
	other := newHome(t, app, "other@example.com", "UTC", "07:00")
	put(t, other, "/me/baseline", map[string]any{"monday": 5, "tuesday": 5})
	newChore(t, other, "Tub", "bathroom", 1)

	app.Clock.Set(utc(2, 7, 0))
	app.RunAllocation(t)
	completeToday(t, a, "Tub") // a two-person Completion: both partners get the date
	completeToday(t, other, "Tub")
	app.Clock.Set(utc(3, 7, 0))
	app.RunAllocation(t)
	completeToday(t, b, "Tub")

	aID, bID := residentID(t, app, "a@example.com"), residentID(t, app, "b@example.com")
	mar2, mar3 := allocation.NewDate(2026, 3, 2), allocation.NewDate(2026, 3, 3)
	home := homeIDOf(t, a)

	s := loadStateAt(t, app, home, mar3)
	ra, rb := residentOf(t, s, aID), residentOf(t, s, bID)
	if got := ra.Preferences; len(got) != 1 || got[mop] != allocation.Dislike {
		t.Errorf("A's Preferences = %v, want only the inherited dislike of Mop (Tub is a specific neutral)", got)
	}
	if got := rb.Preferences; len(got) != 1 || got[mop] != allocation.Like {
		t.Errorf("B's Preferences = %v, want only the like of Mop", got)
	}
	for name, r := range map[string]allocation.Resident{"A": ra, "B": rb} {
		if got := r.LastDone; len(got) != 1 || got[tub] != mar3 {
			t.Errorf("%s LastDone = %v, want only Tub on %d (latest of two Completions, both partners)", name, got, mar3)
		}
	}

	// A replay of the earlier date does not read the future.
	if got := residentOf(t, loadStateAt(t, app, home, mar2), aID).LastDone; len(got) != 1 || got[tub] != mar2 {
		t.Errorf("LastDone on Mar 2 = %v, want Tub on %d", got, mar2)
	}
}
