package schedule

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// run simulates a daily refresh from the Chore's creation to last and returns
// the stored Task after each day, applying every Decision like the store does.
// closeOn lists days on which the open Task is completed first.
func run(c Chore, last allocation.Date, closeOn map[allocation.Date]bool) map[allocation.Date]*Task {
	var cur *Task
	out := map[allocation.Date]*Task{}
	for day := c.Created; day <= last; day++ {
		if cur != nil && !cur.Done && closeOn[day] {
			cur.Done, cur.ClosedOn = true, day
		}
		switch dec := Decide(c, cur, day); dec.Action {
		case Open:
			cur = &Task{WindowStart: dec.WindowStart, WindowEnd: dec.WindowEnd, CurrentEffort: dec.Effort}
		case SetEffort:
			cur.CurrentEffort = dec.Effort
		}
		if cur != nil {
			cp := *cur
			out[day] = &cp
		}
	}
	return out
}

func TestBuildUpGrowsOnePerMissedWindowAndCapsAtFive(t *testing.T) {
	c := Chore{IntervalDays: intp(3), BaseEffort: 2, BuildsUp: true, Created: d(1)}
	got := run(c, d(30), nil)
	// Window length 3: missed windows = floor((day-1)/3).
	for day, want := range map[int]int{1: 2, 3: 2, 4: 3, 6: 3, 7: 4, 10: 5, 13: 5, 30: 5} {
		if e := got[d(day)].CurrentEffort; e != want {
			t.Errorf("day %d: effort %d, want %d", day, e, want)
		}
	}
	if got[d(30)].WindowStart != d(1) || got[d(30)].WindowEnd != d(3) {
		t.Errorf("the missed Task must keep its original window, got %+v", got[d(30)])
	}
}

func TestJumpingSeveralWindowsEqualsSteppingDaily(t *testing.T) {
	c := Chore{IntervalDays: intp(2), BaseEffort: 1, BuildsUp: true, Created: d(1)}
	stepped := run(c, d(9), nil)[d(9)]
	jump := Decide(c, nil, d(9))
	if jump.Action != Open || jump.Effort != stepped.CurrentEffort || jump.WindowStart != stepped.WindowStart {
		t.Fatalf("jump %+v, stepped %+v", jump, stepped)
	}
}

func TestChoreWithoutBuildUpKeepsBaseEffort(t *testing.T) {
	c := Chore{IntervalDays: intp(1), BaseEffort: 2, Created: d(1)}
	if e := run(c, d(20), nil)[d(20)].CurrentEffort; e != 2 {
		t.Fatalf("effort %d, want 2", e)
	}
}

func TestDecideIsIdempotent(t *testing.T) {
	c := Chore{IntervalDays: intp(3), BaseEffort: 2, BuildsUp: true, Created: d(1)}
	got := run(c, d(8), nil)[d(8)]
	if dec := Decide(c, got, d(8)); dec.Action != Nothing {
		t.Fatalf("second run decided %+v", dec)
	}
}

func TestSkippingNeverOpensASecondTask(t *testing.T) {
	c := Chore{IntervalDays: intp(2), BaseEffort: 1, Created: d(1)}
	open := Task{WindowStart: d(1), WindowEnd: d(2), CurrentEffort: 1}
	for day := 1; day <= 28; day++ {
		if dec := Decide(c, &open, d(day)); dec.Action == Open {
			t.Fatalf("day %d: opened a second Task", day)
		}
	}
}

func TestWeekdayLimitedChoreOpensOnlyOnAllowedDays(t *testing.T) {
	// Created on Wednesday 4 March; allowed Monday (1) and Thursday (4).
	c := Chore{IntervalDays: intp(3), AllowedWeekdays: []int{1, 4}, BaseEffort: 2, Created: d(4)}
	got := run(c, d(31), map[allocation.Date]bool{d(5): true, d(13): true, d(21): true})
	opened := map[allocation.Date]bool{}
	for _, task := range got {
		opened[task.WindowStart] = true
	}
	if len(opened) < 3 {
		t.Fatalf("expected several windows, got %v", opened)
	}
	for start := range opened {
		if w := Weekday(start); w != 1 && w != 4 {
			t.Errorf("window starting on weekday %d (%d March) is not allowed", w, int(start-d(0)))
		}
	}
	// 3 days rounded up to a week; the first allowed day on or after Wed 4 is Thu 5.
	if first := got[d(5)]; first == nil || first.WindowStart != d(5) || first.WindowEnd != d(11) {
		t.Errorf("first window = %+v, want Thursday 5 to Wednesday 11", first)
	}
	if got[d(4)] != nil {
		t.Errorf("a Task was open on Wednesday, a disallowed day")
	}
}

func TestWeekdayLimitedChoreWaitsForItsFirstAllowedDay(t *testing.T) {
	// Created on Tuesday 3 March; allowed Monday only.
	c := Chore{IntervalDays: intp(7), AllowedWeekdays: []int{1}, BaseEffort: 1, Created: d(3)}
	for day := 3; day <= 8; day++ {
		if dec := Decide(c, nil, d(day)); dec.Action != Nothing {
			t.Errorf("day %d: %+v, want Nothing before Monday", day, dec)
		}
	}
	dec := Decide(c, nil, d(9))
	if dec.Action != Open || dec.WindowStart != d(9) || dec.WindowEnd != d(15) {
		t.Fatalf("Monday 9: %+v", dec)
	}
}

func TestOneOffProducesExactlyOneTask(t *testing.T) {
	c := Chore{BaseEffort: 4, BuildsUp: true, Created: d(1)}
	opened := 0
	var cur *Task
	for day := 1; day <= 60; day++ {
		if cur != nil && day == 10 {
			cur.Done, cur.ClosedOn = true, d(day)
		}
		for rep := 0; rep < 2; rep++ { // twice a day
			dec := Decide(c, cur, d(day))
			if dec.Action == Open {
				opened++
				cur = &Task{WindowStart: dec.WindowStart, WindowEnd: dec.WindowEnd, CurrentEffort: dec.Effort}
			}
			if dec.Action == SetEffort {
				t.Fatalf("day %d: a one-off never builds up", day)
			}
		}
	}
	if opened != 1 {
		t.Fatalf("opened %d Tasks, want 1", opened)
	}
}

func TestNextWindowStartsIntervalAfterCompletion(t *testing.T) {
	c := Chore{IntervalDays: intp(4), BaseEffort: 2, BuildsUp: true, Created: d(1)}
	done := &Task{Done: true, WindowStart: d(1), WindowEnd: d(4), CurrentEffort: 4, ClosedOn: d(6)}
	if dec := Decide(c, done, d(9)); dec.Action != Nothing {
		t.Fatalf("day 9: %+v, want Nothing", dec)
	}
	dec := Decide(c, done, d(10))
	want := Decision{Action: Open, WindowStart: d(10), WindowEnd: d(13), Effort: 2}
	if dec != want {
		t.Fatalf("day 10: %+v, want %+v (Effort back to base)", dec, want)
	}
}

func TestWindowsKeepWholeDaysAcrossDaylightSaving(t *testing.T) {
	// 2026-03-08 is the US spring-forward day. Dates are calendar days, so a
	// 3-day window from the 7th ends on the 9th whatever the clocks do.
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Skip("no tzdata")
	}
	local := time.Date(2026, time.March, 7, 23, 30, 0, 0, loc)
	created := allocation.NewDate(local.Year(), local.Month(), local.Day())
	c := Chore{IntervalDays: intp(3), BaseEffort: 1, Created: created}
	dec := Decide(c, nil, created)
	if dec.WindowStart != d(7) || dec.WindowEnd != d(9) {
		t.Fatalf("window %+v", dec)
	}
}
