// Package schedule decides when a Chore's Tasks open (ADR 0001). Decide is a
// pure function of the Chore, its latest Task and today's date: no database,
// HTTP or clock, which purity_test.go enforces. The caller supplies "today"
// as a calendar date in the Home's zone.
//
// Windows:
//
//   - A recurring Chore with interval N has windows of N consecutive days. The
//     first starts on the date the Chore was created. WindowStart and
//     WindowEnd are inclusive dates.
//   - A weekday-limited Chore only opens a Task on an allowed weekday: the
//     window starts on the first allowed day on or after the scheduled start,
//     and is N rounded up to whole weeks, so every window holds every allowed
//     weekday at least once.
//   - A one-off Chore opens one Task, once. Its window is one day, or a week
//     when weekdays are limited.
//   - After a Task is done, the next window of a recurring Chore is scheduled
//     N days after the day it was closed (then the weekday rule applies).
//
// A window is missed when today is after its WindowEnd and the Task is still
// open. The same Task stays open. Missed windows are derived from dates, never
// counted, so running twice or skipping a day gives the same answer:
// missed = floor((today - WindowStart) / window length). Only a recurring
// Chore that builds up grows its current Effort: min(5, base + missed).
package schedule

import (
	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// MaxEffort caps a build-up Chore's current Effort.
const MaxEffort = 5

// Chore is the part of a Chore that decides its schedule. IntervalDays nil
// means one-off. AllowedWeekdays uses 0 = Sunday to 6; empty means any day.
// Created is the Home-local date the Chore was created on.
type Chore struct {
	IntervalDays    *int
	AllowedWeekdays []int
	BuildsUp        bool
	BaseEffort      int
	Created         allocation.Date
}

// Task is the Chore's latest Task, open or done. ClosedOn is meaningful only
// when Done.
type Task struct {
	Done          bool
	WindowStart   allocation.Date
	WindowEnd     allocation.Date
	CurrentEffort int
	ClosedOn      allocation.Date
}

// Action is what the caller must do.
type Action int

const (
	// Nothing means the stored Tasks are already right.
	Nothing Action = iota
	// Open means insert a new open Task with the Decision's window and Effort.
	Open
	// SetEffort means change the open Task's current Effort to Decision.Effort.
	SetEffort
)

// Decision is the result of Decide. WindowStart and WindowEnd are set for Open.
type Decision struct {
	Action      Action
	WindowStart allocation.Date
	WindowEnd   allocation.Date
	Effort      int
}

// Decide says what to do for a Chore given its latest Task (nil if it never
// had one) and today.
func Decide(c Chore, latest *Task, today allocation.Date) Decision {
	if latest != nil && !latest.Done {
		return decideOpen(c, *latest, today)
	}

	var start allocation.Date
	switch {
	case latest == nil:
		start = firstAllowed(c.AllowedWeekdays, c.Created)
	case c.IntervalDays == nil:
		return Decision{} // a one-off gets exactly one Task, ever
	default:
		start = firstAllowed(c.AllowedWeekdays, latest.ClosedOn+allocation.Date(*c.IntervalDays))
	}
	if today < start {
		return Decision{}
	}
	end := start + allocation.Date(windowLength(c)-1)
	return Decision{Action: Open, WindowStart: start, WindowEnd: end, Effort: effort(c, start, end, today)}
}

func decideOpen(c Chore, t Task, today allocation.Date) Decision {
	want := effort(c, t.WindowStart, t.WindowEnd, today)
	if want == t.CurrentEffort {
		return Decision{}
	}
	return Decision{Action: SetEffort, Effort: want}
}

// effort is the current Effort of a Task with that window as of today.
func effort(c Chore, start, end, today allocation.Date) int {
	if c.IntervalDays == nil || !c.BuildsUp {
		return c.BaseEffort
	}
	length := int(end-start) + 1
	missed := 0
	if today > start {
		missed = int(today-start) / length
	}
	return min(MaxEffort, c.BaseEffort+missed)
}

// windowLength is the number of days in a new window of the Chore.
func windowLength(c Chore) int {
	limited := len(c.AllowedWeekdays) > 0
	if c.IntervalDays == nil {
		if limited {
			return 7
		}
		return 1
	}
	n := *c.IntervalDays
	if limited && n%7 != 0 {
		n += 7 - n%7
	}
	return n
}

// firstAllowed returns the first date on or after from whose weekday is
// allowed; with no limit, from itself.
func firstAllowed(allowed []int, from allocation.Date) allocation.Date {
	if len(allowed) == 0 {
		return from
	}
	for i := 0; i < 7; i++ {
		day := from + allocation.Date(i)
		for _, w := range allowed {
			if day.Weekday() == w {
				return day
			}
		}
	}
	return from
}
