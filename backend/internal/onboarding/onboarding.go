// Package onboarding is the ordered list of steps a new User walks through and
// the rules for moving along it. It is pure: no database, HTTP or clock.
//
// The stored value on a User is the last step they completed or skipped, ""
// when they have not started, or Done. Step ids are stored, so they are
// permanent.
package onboarding

import "slices"

// Done is stored once a User has finished onboarding. It is not a step the
// client can write.
const Done = "done"

// HomeStep is the last step, completed by creating the Home.
const HomeStep = "home"

// steps are the ids in the order the User walks them.
var steps = []string{"install", "reminders", "baseline", "restrictions", "preferences", HomeStep}

// Steps returns the step ids in order. The caller owns the copy.
func Steps() []string { return slices.Clone(steps) }

// Valid reports whether step is one a client may record with PUT. The last
// step, "home", is completed by creating the Home, and Done by finishing, so
// neither can be written by hand.
func Valid(step string) bool {
	i := slices.Index(steps, step)
	return i >= 0 && i < len(steps)-1
}

// Next is the step to show a User whose stored step is stored: the one after
// it, or Done. A stored value this release does not know shows the first step.
func Next(stored string) string {
	if stored == Done {
		return Done
	}
	i := slices.Index(steps, stored)
	switch {
	case i < 0:
		return steps[0]
	case i+1 >= len(steps):
		return Done
	}
	return steps[i+1]
}

// Before returns the stored values that step moves forward from: every step
// strictly before it. Not started is NULL in the database, so it is not listed.
// Writing step is allowed only while the stored value is NULL or in this list,
// which is what makes progress monotonic.
func Before(step string) []string {
	if step == Done {
		return Steps()
	}
	i := slices.Index(steps, step)
	if i < 0 {
		return nil
	}
	return slices.Clone(steps[:i])
}
