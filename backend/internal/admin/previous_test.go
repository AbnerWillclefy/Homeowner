package admin_test

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// atNoonOn4March puts the clock at 09:00 UTC on 4 March 2026: a 7d window is
// 26 Feb..4 Mar and its previous window is 19..25 Feb.
func atNoonOn4March(app *apitest.App) {
	app.Clock.Set(time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC))
}

func exec(t *testing.T, app *apitest.App, sql string, args ...any) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func TestOverviewPreviousCoversTheNDaysBeforeTheWindowAndNothingElse(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	apitest.ExtraResident(t, app, a, "b@example.com")
	ra, rb := residentOf(t, app, "a@example.com"), residentOf(t, app, "b@example.com")
	atNoonOn4March(app)
	// Four days around the boundaries: the day before the previous window,
	// its first and last days, and the first day of the current window.
	for _, date := range []string{"2026-02-18", "2026-02-19", "2026-02-25", "2026-02-26"} {
		exec(t, app, `INSERT INTO allocation_runs (home_id, plan_date, allocator, outcome, created_at)
			SELECT home_id, $1::text::date, 'baseline', 'planned', now() FROM residents WHERE id = $2`, date, ra)
	}
	for date, resident := range map[string]string{"2026-02-18": ra, "2026-02-19": ra, "2026-02-25": rb, "2026-02-26": rb} {
		exec(t, app, `INSERT INTO checkins (resident_id, checkin_date, level, created_at, updated_at)
			VALUES ($1, $2::text::date, 'normal', now(), now())`, resident, date)
	}

	got := overview(t, app.SignInAsSuperAdmin("admin@example.com"), "7d")

	p := got.Previous
	if p.From != "2026-02-19" || p.To != "2026-02-25" {
		t.Fatalf("previous = %s..%s, want 2026-02-19..2026-02-25", p.From, p.To)
	}
	if p.Runs != 2 || p.Checkins != 2 {
		t.Errorf("previous runs/checkins = %d/%d, want 2/2 (18 Feb and 26 Feb belong elsewhere)", p.Runs, p.Checkins)
	}
	if p.Active != (admin.Active{Homes: 1, Residents: 2}) {
		t.Errorf("previous active = %+v, want 1 Home and 2 Residents", p.Active)
	}
	for _, day := range got.Days {
		want := 0
		if day.Date == "2026-02-26" {
			want = 1
		}
		if day.Runs != want || day.Checkins != want {
			t.Errorf("%s runs/checkins = %d/%d, want %d", day.Date, day.Runs, day.Checkins, want)
		}
	}
	if got.Active != (admin.Active{Homes: 1, Residents: 1}) {
		t.Errorf("active = %+v, want 1 Home and 1 Resident", got.Active)
	}
}

func TestOverviewPreviousOfAnEmptyWindowIsZeroNotNull(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/overview?range=30d")

	p, ok := res.Body["previous"].(map[string]any)
	if !ok {
		t.Fatalf("previous = %v in %s, want an object", res.Body["previous"], res.Raw)
	}
	for _, k := range []string{"runs", "rejected", "fallbacks", "checkins", "completions", "refuses", "takes", "swapsAccepted"} {
		if v, ok := p[k].(float64); !ok || v != 0 {
			t.Errorf("previous.%s = %v, want 0", k, p[k])
		}
	}
	for _, k := range []string{"active", "pushes"} {
		m, ok := p[k].(map[string]any)
		if !ok || len(m) == 0 {
			t.Fatalf("previous.%s = %v, want an object", k, p[k])
		}
		for name, v := range m {
			if n, ok := v.(float64); !ok || n != 0 {
				t.Errorf("previous.%s.%s = %v, want 0", k, name, v)
			}
		}
	}
}

func TestOverviewPreviousEqualsTheCurrentSumsOfNDaysEarlier(t *testing.T) {
	t.Parallel()
	app, _ := flowWeek(t)
	su := app.SignInAsSuperAdmin("admin@example.com")
	thisWeek := overview(t, su, "7d")

	app.Clock.Set(app.Clock.Now().AddDate(0, 0, 7))
	next := overview(t, su, "7d")

	var sum admin.DayCounts
	for _, d := range thisWeek.Days {
		addInts(reflect.ValueOf(&sum).Elem(), reflect.ValueOf(d.DayCounts))
	}
	if sum.Runs == 0 {
		t.Fatal("setup: the fixture week has no runs")
	}
	if next.Previous.DayCounts != sum || next.Previous.Active != thisWeek.Active {
		t.Errorf("previous = %+v active %+v, want %+v active %+v",
			next.Previous.DayCounts, next.Previous.Active, sum, thisWeek.Active)
	}
	if next.Previous.From != thisWeek.From || next.Previous.To != thisWeek.To {
		t.Errorf("previous = %s..%s, want %s..%s", next.Previous.From, next.Previous.To, thisWeek.From, thisWeek.To)
	}
}

// addInts adds every int field of src into dst, recursing into structs, so a
// counter added to DayCounts is summed without touching the test.
func addInts(dst, src reflect.Value) {
	for i := 0; i < dst.NumField(); i++ {
		switch f := dst.Field(i); f.Kind() {
		case reflect.Int:
			f.SetInt(f.Int() + src.Field(i).Int())
		case reflect.Struct:
			addInts(f, src.Field(i))
		}
	}
}
