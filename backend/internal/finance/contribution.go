package finance

import (
	"cmp"
	"slices"
	"time"
)

// maxContributionMonths bounds the contribution split's simulation.
const maxContributionMonths = 120

// ContributionGoal is a Goal as the contribution split reads it. Due is the first
// day of its target month (UTC), nil when it has no date.
type ContributionGoal struct {
	ID     string
	Target int64
	Due    *time.Time
}

// ContributionIn is the contribution split's input, in centavos. Now is the first
// day, UTC, of the current São Paulo month: the rule never reads a clock. Goals
// are in the User's order; GoalsPot is the sum of the Investments that serve Goals.
type ContributionIn struct {
	ReserveTarget *int64 // nil when no reserve target is set
	ReserveSaved  int64
	Goals         []ContributionGoal
	GoalsPot      int64
	Base          int64
	SharePercent  int64 // the reserve's share of Base, 0..100
	Now           time.Time
}

// GoalContribution is one Goal's part of the contribution split.
type GoalContribution struct {
	ID     string
	Saved  int64      // already saved for it, from the pot
	Amount int64      // this month's amount
	Month  *time.Time // expected month; nil when not reached within 120 months
	Late   bool       // has a date and is expected after it
}

// ContributionOut is the contribution split. ReserveAmount + the Goals' Amounts +
// Unassigned equal Base plus any pot surplus no Goal could take.
type ContributionOut struct {
	ReserveAmount int64
	ReserveMonth  *time.Time
	Goals         []GoalContribution
	Unassigned    int64
}

// contributionRun is one simulation; month offsets count from Now, -1 for none.
type contributionRun struct {
	reserve       int64 // the reserve's amount this month
	reserveOffset int
	goals         []GoalContribution
	offsets       []int
	unassigned    int64
	firstUnfilled int // first Goal not full from the pot, -1 for none
	reserveFull   bool
}

// SplitContribution says where this month's Base goes: the reserve takes its
// share (never more than it misses), the Goals get the rest, dated Goals first.
func SplitContribution(in ContributionIn) ContributionOut {
	r := runContribution(in, in.Base)
	out := ContributionOut{ReserveAmount: r.reserve, Goals: r.goals, Unassigned: r.unassigned}
	if in.Base > 0 { // nothing is contributed without a base: no expected months
		out.ReserveMonth = monthAt(in.Now, r.reserveOffset)
		for i := range out.Goals {
			out.Goals[i].Month = monthAt(in.Now, r.offsets[i])
		}
	}
	for i, g := range in.Goals {
		out.Goals[i].Late = g.Due != nil && out.Goals[i].Saved < g.Target && (out.Goals[i].Month == nil || out.Goals[i].Month.After(*g.Due))
	}
	return out
}

// ContributionExtra is what a leftover above the Base changes.
type ContributionExtra struct {
	Extra        int64 // leftover - base
	MonthsSooner *int  // nil when not reached within 120 months either way
}

// Extra reruns the simulation with the leftover in place of the Base and says how
// many months sooner the reserve is reached, or the first unfilled Goal once the
// reserve is full. It answers only when the leftover is above the Base.
func Extra(in ContributionIn, leftover int64) (ContributionExtra, bool) {
	if leftover <= in.Base {
		return ContributionExtra{}, false
	}
	base, more := runContribution(in, in.Base), runContribution(in, leftover)
	out := ContributionExtra{Extra: leftover - in.Base}
	a, b := base.reserveOffset, more.reserveOffset
	if base.reserveFull {
		if base.firstUnfilled < 0 {
			return out, true
		}
		a, b = base.offsets[base.firstUnfilled], more.offsets[base.firstUnfilled]
	}
	if a >= 0 && b >= 0 {
		sooner := a - b
		out.MonthsSooner = &sooner
	}
	return out, true
}

// CategoryOver is a Spending Category whose spending passed its Spending limit.
type CategoryOver struct {
	Category  string
	OverCents int64
}

// OverLimit returns the categories whose spending is over their limit, with the
// amount over, largest first (ties by category). totals is Totals.ByCategory.
func OverLimit(totals, limits map[string]int64) []CategoryOver {
	var out []CategoryOver
	for c, limit := range limits {
		if over := totals[c] - limit; over > 0 {
			out = append(out, CategoryOver{c, over})
		}
	}
	slices.SortFunc(out, func(a, b CategoryOver) int {
		return cmp.Or(cmp.Compare(b.OverCents, a.OverCents), cmp.Compare(a.Category, b.Category))
	})
	return out
}

func monthAt(now time.Time, offset int) *time.Time {
	if offset < 0 {
		return nil
	}
	m := now.AddDate(0, offset, 0)
	return &m
}

func runContribution(in ContributionIn, base int64) contributionRun {
	base = max(base, 0)
	n := len(in.Goals)
	r := contributionRun{goals: make([]GoalContribution, n), offsets: make([]int, n), firstUnfilled: -1, reserveOffset: -1}
	// dated: the Goals with a date, earliest first (the list order breaks ties).
	var dated []int
	for i, g := range in.Goals {
		if g.Due != nil {
			dated = append(dated, i)
		}
	}
	slices.SortStableFunc(dated, func(a, b int) int { return in.Goals[a].Due.Compare(*in.Goals[b].Due) })
	// fill is the pot's order and the last step's: dated Goals, then the others.
	fill := slices.Clone(dated)
	for i, g := range in.Goals {
		if g.Due == nil {
			fill = append(fill, i)
		}
	}
	saved := make([]int64, n)
	pot := max(in.GoalsPot, 0)
	for _, i := range fill {
		saved[i] = min(pot, max(in.Goals[i].Target, 0))
		pot -= saved[i]
		r.goals[i] = GoalContribution{ID: in.Goals[i].ID, Saved: saved[i]}
	}
	r.unassigned = pot
	missingReserve := func(reserve int64) int64 {
		if in.ReserveTarget == nil {
			return 0
		}
		return max(*in.ReserveTarget-reserve, 0)
	}
	reserve := in.ReserveSaved
	r.reserveFull = missingReserve(reserve) == 0
	if in.ReserveTarget != nil && r.reserveFull {
		r.reserveOffset = 0
	}
	for i, g := range in.Goals {
		r.offsets[i] = -1
		if saved[i] >= g.Target {
			r.offsets[i] = 0
		} else if r.firstUnfilled < 0 {
			r.firstUnfilled = i
		}
	}
	share := (base*in.SharePercent + 50) / 100
	for m := range maxContributionMonths {
		take := min(share, missingReserve(reserve))
		reserve += take
		money := base - take
		if m == 0 {
			r.reserve = take
		}
		if in.ReserveTarget != nil && r.reserveOffset < 0 && missingReserve(reserve) == 0 {
			r.reserveOffset = m
		}
		pay := func(i int, amount int64) {
			amount = min(amount, money)
			saved[i] += amount
			money -= amount
			if m == 0 {
				r.goals[i].Amount += amount
			}
		}
		for _, i := range dated {
			left := max(monthIndex(*in.Goals[i].Due)-(monthIndex(in.Now)+m)+1, 1)
			pay(i, (max(in.Goals[i].Target-saved[i], 0)+int64(left)-1)/int64(left))
		}
		for i, g := range in.Goals { // the list order: the first unfilled Goal, then the next
			pay(i, max(g.Target-saved[i], 0))
		}
		for i, g := range in.Goals {
			if r.offsets[i] < 0 && saved[i] >= g.Target {
				r.offsets[i] = m
			}
		}
		if m == 0 {
			r.unassigned += money
		}
	}
	return r
}
