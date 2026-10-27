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

func TestPreviousIsTheNDatesBeforeTheWindowOldestFirst(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 3, 2, 23, 30, 0, 0, time.UTC)
	r7, _ := ParseRange("7d")
	r30, _ := ParseRange("30d")

	got := r7.Previous(now)

	want := []string{"2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Previous = %v, want %v (crossing a month boundary)", got, want)
	}
	p := r30.Previous(now)
	if len(p) != 30 || p[0] != "2026-01-02" || p[29] != "2026-01-31" {
		t.Fatalf("30d Previous = %v", p)
	}
}

func TestPreviousEndsTheDayBeforeTheWindowStarts(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)
	for _, name := range []string{"7d", "30d"} {
		r, _ := ParseRange(name)
		prev, cur := r.Previous(now), r.Window(now)
		last, _ := time.Parse(dateLayout, prev[len(prev)-1])
		first, _ := time.Parse(dateLayout, cur[0])
		if !last.AddDate(0, 0, 1).Equal(first) {
			t.Errorf("%s: previous ends %s, window starts %s", name, prev[len(prev)-1], cur[0])
		}
	}
}

func TestPreviousUsesTheUTCDateOfAZonedInstant(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 3, 1, 22, 0, 0, 0, time.FixedZone("BRT", -3*3600)) // 2 March in UTC
	r, _ := ParseRange("7d")

	days := r.Previous(now)

	if days[len(days)-1] != "2026-02-23" {
		t.Fatalf("last previous day = %s, want 2026-02-23", days[len(days)-1])
	}
}

func TestZeroFillKeepsOrderAndAddsMissingDays(t *testing.T) {
	t.Parallel()
	days := []string{"2026-03-01", "2026-03-02", "2026-03-03"}
	got := map[string]Day{"2026-03-02": {Date: "2026-03-02", DayCounts: DayCounts{Runs: 2}}}

	out := ZeroFill(days, got)

	want := []Day{{Date: "2026-03-01"}, {Date: "2026-03-02", DayCounts: DayCounts{Runs: 2}}, {Date: "2026-03-03"}}
	if !reflect.DeepEqual(out, want) {
		t.Fatalf("ZeroFill = %+v, want %+v", out, want)
	}
}
