package admin

import (
	"reflect"
	"testing"
	"time"
)

func TestParseRange(t *testing.T) {
	t.Parallel()
	for in, days := range map[string]int{"7d": 7, "30d": 30} {
		r, err := ParseRange(in)
		if err != nil || r.Days != days || r.Name != in {
			t.Errorf("ParseRange(%q) = %+v, %v, want %d days", in, r, err, days)
		}
	}
	for _, in := range []string{"", "1d", "7D", "90d", " 7d", "7", "7d "} {
		if _, err := ParseRange(in); err == nil {
			t.Errorf("ParseRange(%q) succeeded, want an error", in)
		}
	}
}

func TestWindowIsTheLastNUTCDatesOldestFirst(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 3, 2, 23, 30, 0, 0, time.UTC)
	r, _ := ParseRange("7d")

	got := r.Window(now)

	want := []string{"2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Window = %v, want %v (crossing a month boundary)", got, want)
	}
}

func TestWindowUsesTheUTCDateOfAZonedInstant(t *testing.T) {
	t.Parallel()
	// 22:00 on 1 March in Sao Paulo (UTC-3) is already 2 March in UTC.
	now := time.Date(2026, 3, 1, 22, 0, 0, 0, time.FixedZone("BRT", -3*3600))
	r, _ := ParseRange("7d")

	days := r.Window(now)

	if last := days[len(days)-1]; last != "2026-03-02" {
		t.Fatalf("last day = %s, want 2026-03-02", last)
	}
}

func TestWindowOf30DaysHasThirtyEntries(t *testing.T) {
	t.Parallel()
	r, _ := ParseRange("30d")

	days := r.Window(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC))

	if len(days) != 30 || days[0] != "2026-01-31" || days[29] != "2026-03-01" {
		t.Fatalf("Window = %v", days)
	}
}

func TestPreviousIsTheNDaysRightBeforeTheWindow(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)
	r, _ := ParseRange("7d")

	got := r.Previous(now)

	want := []string{"2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Previous = %v, want %v", got, want)
	}
	if cur := r.Window(now); cur[0] != "2026-02-26" {
		t.Fatalf("window starts %s, want it to follow the previous window", cur[0])
	}
	r30, _ := ParseRange("30d")
	if p := r30.Previous(now); len(p) != 30 || p[29] != "2026-02-02" {
		t.Fatalf("30d Previous = %v", p)
	}
}

func TestZeroFillKeepsOrderAndAddsMissingDays(t *testing.T) {
	t.Parallel()
	days := []string{"2026-03-01", "2026-03-02", "2026-03-03"}
	got := map[string]Day{"2026-03-02": {Date: "2026-03-02", Runs: 2}}

	out := ZeroFill(days, got)

	want := []Day{{Date: "2026-03-01"}, {Date: "2026-03-02", Runs: 2}, {Date: "2026-03-03"}}
	if !reflect.DeepEqual(out, want) {
		t.Fatalf("ZeroFill = %+v, want %+v", out, want)
	}
}
