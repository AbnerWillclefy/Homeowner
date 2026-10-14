// Package allocation is the baseline Allocation module: it proposes a Day Plan
// from the open Tasks and each Resident's Energy (Plan), and referees any Day
// Plan, whoever proposed it (Check). See docs/adr/0004.
//
// Purity rule: the package is stdlib only and does no I/O. It has no database,
// HTTP or clock dependency; the caller supplies "today" in State. This is
// enforced by purity_test.go.
//
// Preferences and Completion history enter as plain data on each Resident.
// They are soft rules: Plan uses them only to choose among Residents who pass
// the hard rules, and Check ignores them.
//
// Definitions used by the sort order of Plan:
//
//   - Hard deadline today: the Task's WindowEnd is on or before State.Today
//     (so an overdue Task counts). There is no deadline field, only windows.
//   - Importance rank: essential, then normal, then nice to have.
//   - Lateness: the number of days State.Today is past WindowStart, never
//     negative. Larger is more urgent.
//
// A two-person Task (People of two or more) goes to exactly two distinct
// Residents, each spending the full Effort, so it appears once per Resident in
// a Day Plan. Plan and Check share peopleNeeded so they cannot disagree.
//
// Preconditions: Effort is 1 to 5 and Energy is a whole number of points.
// Negative Energy is treated as 0. A Task with Effort below 1 is invalid and
// is left in the pool with ReasonInvalidEffort.
package allocation

import "time"

// Date is a calendar date as a count of days since 1970-01-01, in the Home's
// zone. Using days keeps the package free of any clock.
type Date int

// NewDate returns the Date for a year, month and day.
func NewDate(year int, month time.Month, day int) Date {
	return Date(time.Date(year, month, day, 0, 0, 0, 0, time.UTC).Unix() / 86400)
}

// DateOf returns the Date of t's calendar day in t's own location.
func DateOf(t time.Time) Date { return NewDate(t.Year(), t.Month(), t.Day()) }

// Time returns midnight UTC at the start of the Date.
func (d Date) Time() time.Time { return time.Unix(int64(d)*86400, 0).UTC() }

// Weekday returns 0 = Sunday to 6 = Saturday.
func (d Date) Weekday() int { return int(d.Time().Weekday()) }

// Importance is how much it matters that a Chore gets done.
type Importance string

const (
	Essential  Importance = "essential"
	Normal     Importance = "normal"
	NiceToHave Importance = "nice_to_have"
)

// Rank orders Importance, lower first. Unknown values rank last.
func (i Importance) Rank() int {
	switch i {
	case Essential:
		return 0
	case Normal:
		return 1
	case NiceToHave:
		return 2
	}
	return 3
}

// Demand is something a Chore asks of the body, such as "heavy_lifting".
type Demand string

// Resident is someone who can be given Tasks today.
type Resident struct {
	ID string
	// Energy is today's points, already computed from Baseline and Check-in.
	Energy int
	// DemandRestrictions are the Demands the Resident cannot do today: the
	// User's general ones merged with the day-only ones from the Check-in.
	DemandRestrictions []Demand
	// ChoreRestrictions are the Chores this Resident cannot do in this Home.
	ChoreRestrictions []string
	// Preferences is the effective Preference of the Resident for each Chore,
	// by Chore ID, already resolved by the caller (a specific Preference over a
	// general one). A Chore that is absent is neutral. Read by key only.
	Preferences map[string]Preference
	// LastDone is the Date of the Resident's most recent Completion of each
	// Chore, by Chore ID. A Chore that is absent was never done by the
	// Resident; this is deliberate, because a zero Date is 1970-01-01. Read by
	// key only.
	LastDone map[string]Date
}

// Preference is how much a Resident likes a Chore. Neutral is the zero value,
// so a missing entry means neutral. It is a soft rule: it never makes a
// Resident ineligible (see docs/adr/0004).
type Preference int

const (
	Neutral Preference = iota
	Like
	Dislike
)

// rank orders Preferences for choosing a Resident, lower first: like, neutral,
// dislike.
func (p Preference) rank() int {
	switch p {
	case Like:
		return 0
	case Dislike:
		return 2
	}
	return 1
}

// Task is one open Chore to be done.
type Task struct {
	ID      string
	ChoreID string
	// Effort is the current Effort (1 to 5), not the base.
	Effort      int
	Importance  Importance
	Demands     []Demand
	People      int
	WindowStart Date
	WindowEnd   Date
	// AllowedWeekdays are the days the Chore may be done (0 = Sunday), copied
	// from the Chore. Empty means every day. An overdue Task is still bound by
	// it, so it waits in the pool for an allowed day.
	AllowedWeekdays []int
}

// State is everything Allocation knows. Tasks are open Tasks only.
type State struct {
	Today     Date
	Residents []Resident
	Tasks     []Task
}

// Reason says why a Task was placed or left in the pool. It is data, not
// prose, because it is stored and later rendered by the explanation feature.
type Reason string

const (
	// Assignment reasons: the sort key that placed the Task.
	ReasonDeadlineToday Reason = "deadline_today"
	ReasonImportance    Reason = "importance"
	ReasonLateness      Reason = "lateness"
	ReasonFitsEnergy    Reason = "fits_energy"
	// Preference reasons: a Preference or turn-taking, not urgency, decided
	// which Resident took the Task. They replace the urgency reason.
	ReasonLiked         Reason = "liked"
	ReasonSparedDislike Reason = "spared_dislike"
	ReasonTurnTaking    Reason = "turn_taking"

	// Pool reasons.
	ReasonNoEnergyLeft      Reason = "no_energy_left"
	ReasonRestrictedForAll  Reason = "restricted_for_all"
	ReasonTwoPersonDeferred Reason = "two_person_deferred"
	ReasonInvalidEffort     Reason = "invalid_effort"
	ReasonWeekdayNotAllowed Reason = "weekday_not_allowed"
)

// Assignment gives a Task to a Resident.
type Assignment struct {
	TaskID     string
	ResidentID string
	Reason     Reason
}

// DayPlan is what an Allocation proposes. The pool is every state Task that
// is not assigned.
type DayPlan struct {
	Assignments []Assignment
}

// PoolEntry is a Task left unassigned, and why.
type PoolEntry struct {
	TaskID string
	Reason Reason
}

// Result is a DayPlan plus the pool.
type Result struct {
	DayPlan DayPlan
	Pool    []PoolEntry
}

// Allocator proposes a Day Plan. Baseline is one; the LLM allocator will be
// another behind the same interface.
type Allocator interface {
	// Name goes in the run record of every plan this Allocator makes.
	Name() string
	Plan(State) (Result, error)
}

// ViolationKind names a rule a Day Plan broke.
type ViolationKind string

const (
	OverEnergy        ViolationKind = "over_energy"
	BrokenRestriction ViolationKind = "broken_restriction"
	UnknownTask       ViolationKind = "unknown_task"
	DuplicateTask     ViolationKind = "duplicate_task"
	// WrongResidentCount: a Task in the plan is given to a number of distinct
	// Residents other than the number it needs (two for a two-person Task).
	WrongResidentCount ViolationKind = "wrong_resident_count"
	UnknownResident    ViolationKind = "unknown_resident"
	// WeekdayNotAllowed: the Task's Chore may not be done on State.Today's
	// weekday.
	WeekdayNotAllowed ViolationKind = "weekday_not_allowed"
)

// RestrictionLevel says which kind of Restriction was broken.
type RestrictionLevel string

const (
	LevelDemand RestrictionLevel = "demand"
	LevelChore  RestrictionLevel = "chore"
)

// Violation is one broken rule found by Check.
type Violation struct {
	Kind       ViolationKind
	TaskID     string
	ResidentID string
	// Level is set only for BrokenRestriction.
	Level  RestrictionLevel
	Detail string
}
