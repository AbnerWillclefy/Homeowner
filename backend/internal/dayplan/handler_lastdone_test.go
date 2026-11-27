package dayplan_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// A Task carries when its Chore was last done and by whom (lastDone), read
// from the Chore's latest Completion.

func everyDay() map[string]any {
	all := map[string]any{}
	for _, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
		all[d] = 4
	}
	return all
}

// dailyDuo is A and B planned on Monday at 07:00 with one Chore due every day.
func dailyDuo(t *testing.T, chore map[string]any) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	apitest.SetBaseline(t, a, everyDay())
	apitest.SetBaseline(t, b, everyDay())
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, a, chore)
	app.Clock.Set(apitest.MondayAt(7))
	app.RunAllocation(t)
	return app, a, b
}

// plannedOn runs the Allocation of day n of March at 07:00 and leaves the clock at 09:00.
func plannedOn(t *testing.T, app *apitest.App, day int) {
	app.Clock.Set(time.Date(2026, time.March, day, 7, 0, 0, 0, time.UTC))
	app.RunAllocation(t)
	app.Clock.Set(time.Date(2026, time.March, day, 9, 0, 0, 0, time.UTC))
}

// taskOf finds the Task of the named Chore wherever the plan shows it.
func taskOf(t *testing.T, c *apitest.Client, name string) map[string]any {
	t.Helper()
	body := apitest.DayPlan(t, c).Body
	all := apitest.TaskList(t, body["mine"])
	all = append(all, apitest.TaskList(t, body["pool"])...)
	for _, o := range apitest.TaskList(t, body["others"]) {
		all = append(all, apitest.TaskList(t, o["tasks"])...)
	}
	for _, tk := range all {
		if tk["choreName"] == name {
			return tk
		}
	}
	t.Fatalf("no Task %q in %s", name, apitest.DayPlan(t, c).Raw)
	return nil
}

func lastDoneOf(t *testing.T, tk map[string]any) (date string, who []string) {
	t.Helper()
	ld, ok := tk["lastDone"].(map[string]any)
	if !ok {
		t.Fatalf("lastDone = %v, want an object", tk["lastDone"])
	}
	for _, id := range ld["residentIds"].([]any) {
		who = append(who, id.(string))
	}
	return ld["date"].(string), who
}

func TestAChoreNeverDoneHasNullLastDone(t *testing.T) {
	t.Parallel()
	_, a, _ := dailyDuo(t, apitest.Chore("Dishes", 1, 2, "normal", []string{}))
	tk := taskOf(t, a, "Dishes")
	if v, present := tk["lastDone"]; !present || v != nil {
		t.Fatalf("lastDone = %v (present %v), want null", v, present)
	}
}

func TestLastDoneNamesWhoDidItNotWhoIsReading(t *testing.T) {
	t.Parallel()
	app, a, b := dailyDuo(t, apitest.Chore("Dishes", 1, 2, "normal", []string{}))
	doer, reader, doerEmail := a, b, "a@example.com"
	if len(apitest.MineOf(t, a)) == 0 {
		doer, reader, doerEmail = b, a, "b@example.com"
	}
	apitest.MustAct(t, doer, "complete", apitest.MineOf(t, doer)[0]["id"].(string))
	plannedOn(t, app, 3)

	date, who := lastDoneOf(t, taskOf(t, reader, "Dishes"))
	if date != "2026-03-02" || !slices.Equal(who, []string{residentIDOf(t, app, doerEmail)}) {
		t.Fatalf("lastDone = %s %v, want 2026-03-02 by %s", date, who, doerEmail)
	}
}

func TestTwoCompletionsOnOneDayReadAsTheLatestOne(t *testing.T) {
	t.Parallel()
	app, a, b := dailyDuo(t, apitest.Chore("Dishes", 1, 2, "normal", []string{}))
	// Monday's Completion, then Tuesday's, both by whoever holds the Task.
	for day := 2; day <= 3; day++ {
		if day == 3 {
			plannedOn(t, app, 3)
		}
		for _, c := range []*apitest.Client{a, b} {
			if m := apitest.MineOf(t, c); len(m) > 0 {
				apitest.MustAct(t, c, "complete", m[0]["id"].(string))
				break
			}
		}
	}
	// Move Monday's Completion to Tuesday and later in the day than Tuesday's.
	if _, err := app.DB.Exec(context.Background(), `
		UPDATE completions SET completed_on = '2026-03-03', completed_at = '2026-03-03T20:00:00Z'
		WHERE completed_on = '2026-03-02'`); err != nil {
		t.Fatal(err)
	}
	var want string
	if err := app.DB.QueryRow(context.Background(), `
		SELECT cr.resident_id FROM completions k JOIN completion_residents cr ON cr.completion_id = k.id
		WHERE k.completed_at = '2026-03-03T20:00:00Z'`).Scan(&want); err != nil {
		t.Fatal(err)
	}
	plannedOn(t, app, 4)

	date, who := lastDoneOf(t, taskOf(t, a, "Dishes"))
	if date != "2026-03-03" || !slices.Equal(who, []string{want}) {
		t.Fatalf("lastDone = %s %v, want 2026-03-03 by %s (the later Completion)", date, who, want)
	}
}

func TestATwoPersonCompletionListsBothResidentsSorted(t *testing.T) {
	t.Parallel()
	chore := apitest.TwoPersonChore("Carry", 2)
	chore["intervalDays"] = 1
	app, a, b := dailyDuo(t, chore)
	apitest.MustAct(t, a, "complete", apitest.MineOf(t, a)[0]["id"].(string))
	plannedOn(t, app, 3)

	_, who := lastDoneOf(t, taskOf(t, b, "Carry"))
	want := []string{residentIDOf(t, app, "a@example.com"), residentIDOf(t, app, "b@example.com")}
	slices.Sort(want)
	if !slices.Equal(who, want) {
		t.Fatalf("residentIds = %v, want %v", who, want)
	}
}

func TestLastDoneIsTheHomeLocalDateNearMidnight(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := app.SignInAs("a@example.com")
	if r := me.Post("/home", apitest.HomeBody("America/Sao_Paulo", "07:00")); r.Status != 201 {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	apitest.SetBaseline(t, me, everyDay())
	app.Clock.Set(apitest.MondayAt(6))
	apitest.CreateChore(t, me, apitest.Chore("Dishes", 1, 2, "normal", []string{}))
	app.Clock.Set(time.Date(2026, time.March, 3, 10, 0, 0, 0, time.UTC)) // 07:00 on the 3rd at home
	app.RunAllocation(t)
	id := apitest.MineOf(t, me)[0]["id"].(string)
	// 02:30 UTC on the 4th is 23:30 on the 3rd at home.
	app.Clock.Set(time.Date(2026, time.March, 4, 2, 30, 0, 0, time.UTC))
	apitest.MustAct(t, me, "complete", id)
	app.Clock.Set(time.Date(2026, time.March, 4, 10, 0, 0, 0, time.UTC))
	app.RunAllocation(t)

	if date, _ := lastDoneOf(t, taskOf(t, me, "Dishes")); date != "2026-03-03" {
		t.Fatalf("lastDone date = %s, want the Home-local 2026-03-03", date)
	}
}
