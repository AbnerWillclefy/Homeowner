// Package streak is the rule that turns a Resident's history into their
// Streak (ADR 0003, amended by ADR 0014). It is pure: the facts and today's
// date come in as arguments, and nothing is read from a clock or a database.
//
// A day grows the Streak when the Resident did at least one Completion,
// whatever else they Committed to and left undone. It breaks it only when they
// Committed to at least one Task, completed none and did not check in Drained.
// Every other day pauses it. A Drained day cannot break. Refusing or ignoring
// a proposed Task creates no Commitment, so it never reaches a break.
//
// A day is final only once the Home's local date has moved past it, so today
// is never judged a break.
package streak

import (
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// Day is what is known about one Resident on one local date of their Home.
type Day struct {
	Date allocation.Date
	// Completions is how many Completions the Resident is on that day.
	Completions int
	// Undone is how many Tasks they Committed to on that day have no Completion
	// dated that day. A Completion on a later day does not repair it.
	Undone int
	// Drained says their Check-in that day was Drained.
	Drained bool
}

// Outcome is what a day does to the Streak. The zero value is Pause.
type Outcome int

const (
	Pause Outcome = iota
	Grow
	Break
)

func (o Outcome) String() string {
	switch o {
	case Grow:
		return "grow"
	case Break:
		return "break"
	default:
		return "pause"
	}
}

// Judge says what one day does to the Streak.
func Judge(d Day) Outcome {
	switch {
	case d.Completions >= 1:
		return Grow
	case d.Undone > 0 && !d.Drained:
		return Break
	default:
		return Pause
	}
}

// Current is the Resident's Streak on today, from the days that have facts (in
// any order; the days without are pauses). It walks the final days back from
// yesterday: a grow adds one, a pause carries on, a break stops. Today adds one
// only when it already grows (todayGrew); until then it adds nothing and
// breaks nothing. Days after today are ignored.
func Current(days []Day, today allocation.Date) (current int, todayGrew bool) {
	final := make([]Day, 0, len(days))
	for _, d := range days {
		switch {
		case d.Date < today:
			final = append(final, d)
		case d.Date == today:
			todayGrew = Judge(d) == Grow
		}
	}
	slices.SortFunc(final, func(a, b Day) int { return int(b.Date) - int(a.Date) })
	for _, d := range final {
		o := Judge(d)
		if o == Break {
			break
		}
		if o == Grow {
			current++
		}
	}
	if todayGrew {
		current++
	}
	return current, todayGrew
}
