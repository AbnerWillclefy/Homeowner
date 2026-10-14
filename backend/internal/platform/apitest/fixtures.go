package apitest

import (
	"context"
	"net/http"
	"testing"
	"time"
)

// Fixtures every domain's API tests share: a Home with its first Resident,
// Chores, Invites and the assertions on a Response.

func HomeWithResident(t *testing.T, app *App, email string) *Client {
	t.Helper()
	c := app.SignInAs(email)
	if r := c.Post("/home", HomeBody("UTC", "07:00")); r.Status != http.StatusCreated {
		t.Fatalf("POST /home = %d %s", r.Status, r.Raw)
	}
	return c
}

func HomeBody(tz, at string) map[string]any {
	return map[string]any{"timezone": tz, "allocationTime": at}
}

func CreateChore(t *testing.T, c *Client, body map[string]any) string {
	t.Helper()
	r := c.Post("/home/chores", body)
	if r.Status != http.StatusCreated {
		t.Fatalf("POST /home/chores = %d %s", r.Status, r.Raw)
	}
	return r.Body["id"].(string)
}

func Recurring(name string, every, base int, buildsUp bool, weekdays ...int) map[string]any {
	if weekdays == nil {
		weekdays = []int{}
	}
	return map[string]any{
		"name": name, "category": "kitchen", "demands": []string{},
		"baseEffort": base, "importance": "normal", "people": 1,
		"intervalDays": every, "allowedWeekdays": weekdays, "buildsUp": buildsUp,
	}
}

// AtDay moves the fake clock to 09:00 UTC on a March 2026 day (1 March is a
// Sunday; the harness starts on Wednesday the 4th).
func AtDay(app *App, day int) {
	app.Clock.Set(time.Date(2026, time.March, day, 9, 0, 0, 0, time.UTC))
}

func Pool(t *testing.T, c *Client) []map[string]any {
	t.Helper()
	r := c.Get("/home/tasks")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/tasks = %d %s", r.Status, r.Raw)
	}
	l, ok := r.Body["tasks"].([]any)
	if !ok {
		t.Fatalf("tasks is not an array: %s", r.Raw)
	}
	out := make([]map[string]any, len(l))
	for i, v := range l {
		out[i] = v.(map[string]any)
	}
	return out
}

// ValidChore is a recurring Chore every field of which is acceptable.
func ValidChore() map[string]any {
	return map[string]any{
		"name": "Mop floors", "category": "floors", "demands": []string{"bending"},
		"baseEffort": 3, "importance": "normal", "people": 1,
		"intervalDays": 7, "allowedWeekdays": []int{}, "buildsUp": true,
	}
}

// WithField returns a copy of base with key k set to v (nil means JSON null).
func WithField(base map[string]any, k string, v any) map[string]any {
	out := map[string]any{}
	for kk, vv := range base {
		out[kk] = vv
	}
	out[k] = v
	return out
}

func CountChores(t *testing.T, app *App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM chores").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func ListChores(t *testing.T, c *Client) []any {
	t.Helper()
	r := c.Get("/home/chores")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/chores = %d %s", r.Status, r.Raw)
	}
	l, ok := r.Body["chores"].([]any)
	if !ok {
		t.Fatalf("no chores array: %s", r.Raw)
	}
	return l
}

func ExpectStatus(t *testing.T, r Response, want int) {
	t.Helper()
	if r.Status != want {
		t.Fatalf("status = %d %s, want %d", r.Status, r.Raw, want)
	}
}

func ChoreIn(t *testing.T, c *Client, category string, demands []string) string {
	t.Helper()
	return CreateChore(t, c, WithField(WithField(ValidChore(), "category", category), "demands", demands))
}

func SetPreference(t *testing.T, c *Client, choreID, pref string) {
	t.Helper()
	if r := c.Put("/home/chores/"+choreID+"/preference", map[string]any{"preference": pref}); r.Status != http.StatusNoContent {
		t.Fatalf("PUT preference %s = %d %s", pref, r.Status, r.Raw)
	}
}

func Count(t *testing.T, app *App, query string, args ...any) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// CreateInvite has c make an Invite and returns its token.
func CreateInvite(t *testing.T, c *Client) string {
	t.Helper()
	r := c.Post("/home/invites", nil)
	ExpectStatus(t, r, http.StatusCreated)
	tok, _ := r.Body["token"].(string)
	if tok == "" {
		t.Fatalf("no token: %s", r.Raw)
	}
	return tok
}

func AcceptInvite(c *Client, token string, body any) Response {
	return c.Post("/invites/"+token+"/accept", body)
}

// Chore is a one-person Chore due every `every` days.
func Chore(name string, every, effort int, importance string, demands []string, weekdays ...int) map[string]any {
	c := Recurring(name, every, effort, false, weekdays...)
	c["importance"] = importance
	c["demands"] = demands
	return c
}

func ExtraResident(t *testing.T, app *App, first *Client, email string) *Client {
	t.Helper()
	b := app.SignInAs(email)
	b.JoinHome(t, first.Get("/home").Body["id"].(string))
	return b
}

func SetBaseline(t *testing.T, c *Client, days map[string]any) {
	t.Helper()
	if r := c.Put("/me/baseline", days); r.Status != http.StatusNoContent {
		t.Fatalf("PUT /me/baseline = %d %s", r.Status, r.Raw)
	}
}

// Proposals posts answers and returns the proposals array, failing on a non-200.
func Proposals(t *testing.T, c *Client, answers any) []map[string]any {
	t.Helper()
	r := c.Post("/catalog/proposals", answers)
	if r.Status != http.StatusOK {
		t.Fatalf("POST /catalog/proposals = %d %s, want 200", r.Status, r.Raw)
	}
	raw, ok := r.Body["proposals"].([]any)
	if !ok {
		t.Fatalf("no proposals array: %s", r.Raw)
	}
	out := make([]map[string]any, len(raw))
	for i, p := range raw {
		out[i] = p.(map[string]any)
	}
	return out
}

func CatalogEntries(t *testing.T, c *Client) []map[string]any {
	t.Helper()
	r := c.Get("/catalog")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /catalog = %d %s", r.Status, r.Raw)
	}
	raw, ok := r.Body["entries"].([]any)
	if !ok || len(raw) == 0 {
		t.Fatalf("no entries: %s", r.Raw)
	}
	out := make([]map[string]any, len(raw))
	for i, e := range raw {
		out[i] = e.(map[string]any)
	}
	return out
}

// BaselineOf returns the profile's baseline as weekday name to value (nil for
// null), failing if any of the seven keys is missing.
func BaselineOf(t *testing.T, res Response) map[string]any {
	t.Helper()
	if res.Status != http.StatusOK {
		t.Fatalf("got %d %s, want 200", res.Status, res.Raw)
	}
	b, ok := res.Body["baseline"].(map[string]any)
	if !ok || len(b) != 7 {
		t.Fatalf("baseline = %v, want an object with all seven weekdays", res.Body["baseline"])
	}
	for _, d := range weekdays {
		if _, ok := b[d]; !ok {
			t.Fatalf("baseline has no %q key: %v", d, b)
		}
	}
	return b
}

// weekdays are the Baseline's wire keys, Sunday first.
var weekdays = []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}

// Act posts one of the Day Plan actions on a Task: accept, refuse, take or
// complete.
func Act(c *Client, action, taskID string) Response {
	return c.Post("/home/tasks/"+taskID+"/"+action, nil)
}

func MustAct(t *testing.T, c *Client, action, taskID string) Response {
	t.Helper()
	r := Act(c, action, taskID)
	if r.Status != http.StatusOK {
		t.Fatalf("POST %s %s = %d %s", action, taskID, r.Status, r.Raw)
	}
	return r
}

func MineOf(t *testing.T, c *Client) []map[string]any {
	t.Helper()
	return TaskList(t, DayPlan(t, c).Body["mine"])
}

func IDOf(t *testing.T, tasks []map[string]any, name string) string {
	t.Helper()
	for _, tk := range tasks {
		if tk["choreName"] == name {
			return tk["id"].(string)
		}
	}
	t.Fatalf("no Task %q in %v", name, tasks)
	return ""
}

func DayPlan(t *testing.T, c *Client) Response {
	t.Helper()
	r := c.Get("/home/day-plan")
	if r.Status != http.StatusOK {
		t.Fatalf("GET /home/day-plan = %d %s", r.Status, r.Raw)
	}
	return r
}

// TaskList reads an array of Tasks (objects) out of a decoded body.
func TaskList(t *testing.T, v any) []map[string]any {
	t.Helper()
	l, ok := v.([]any)
	if !ok {
		t.Fatalf("not an array: %v", v)
	}
	out := make([]map[string]any, len(l))
	for i, x := range l {
		out[i] = x.(map[string]any)
	}
	return out
}

// MondayAt is 2 March 2026, a Monday, at hour o'clock UTC (the harness Home's
// zone); its Allocation time is 07:00.
func MondayAt(hour int) time.Time {
	return time.Date(2026, time.March, 2, hour, 0, 0, 0, time.UTC)
}

// TwoResidents is a Home planned at 07:00 on Monday for A and B, each with
// Energy 4 (two Effort-2 Tasks): One and Two go to A, Three and Four to B, and
// Five is left in the pool.
func TwoResidents(t *testing.T) (app *App, a, b *Client) {
	t.Helper()
	app = Start(t)
	a = HomeWithResident(t, app, "a@example.com")
	b = ExtraResident(t, app, a, "b@example.com")
	SetBaseline(t, a, map[string]any{"monday": 4, "tuesday": 4})
	SetBaseline(t, b, map[string]any{"monday": 4, "tuesday": 4})
	app.Clock.Set(MondayAt(6))
	for _, n := range []string{"One", "Two", "Three", "Four", "Five"} {
		CreateChore(t, a, Chore(n, 7, 2, "normal", []string{}))
	}
	app.Clock.Set(MondayAt(7))
	app.RunAllocation(t)
	if len(MineOf(t, a)) != 2 || len(MineOf(t, b)) != 2 || len(TaskList(t, DayPlan(t, a).Body["pool"])) != 1 {
		t.Fatalf("setup: %s", DayPlan(t, a).Raw)
	}
	return app, a, b
}

// DuoHome is A and B planned at 07:00 on Monday with the given Energy, and one
// two-person Chore "Carry" of Effort 2.
func DuoHome(t *testing.T, energyA, energyB int) (app *App, a, b *Client) {
	t.Helper()
	app = Start(t)
	a = HomeWithResident(t, app, "a@example.com")
	b = ExtraResident(t, app, a, "b@example.com")
	SetBaseline(t, a, map[string]any{"monday": energyA})
	SetBaseline(t, b, map[string]any{"monday": energyB})
	app.Clock.Set(MondayAt(6))
	CreateChore(t, a, TwoPersonChore("Carry", 2))
	app.Clock.Set(MondayAt(7))
	app.RunAllocation(t)
	return app, a, b
}

// TwoPersonChore is a Chore that takes two people, due every week.
func TwoPersonChore(name string, effort int) map[string]any {
	c := Chore(name, 7, effort, "essential", []string{})
	c["people"] = 2
	return c
}

func LeaveHome(c *Client) Response {
	return c.Delete("/home/residents/me")
}

func CheckIn(t *testing.T, c *Client, level string, restrictions ...string) Response {
	t.Helper()
	if restrictions == nil {
		restrictions = []string{}
	}
	r := c.Put("/home/check-in", map[string]any{"level": level, "restrictions": restrictions})
	if r.Status != http.StatusOK {
		t.Fatalf("PUT /home/check-in = %d %s", r.Status, r.Raw)
	}
	return r
}
