package finance

import "time"

// sameMonth reports whether two days fall in the same calendar month.
func sameMonth(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month()
}

// DailyAllowance is the Leftover split over the days left in `month`, today
// included, in cents, rounded half up (a negative Leftover gives a negative
// allowance). Nil when there is no Leftover (no Monthly income) or `month` is
// not today's month (São Paulo day, see postedOn). The days left are at least
// 1, so it never divides by zero.
func DailyAllowance(leftover *int64, today, month time.Time) *int64 {
	if leftover == nil || !sameMonth(today, month) {
		return nil
	}
	daysLeft := int64(month.AddDate(0, 1, -1).Day() - today.Day() + 1)
	out := halfUp(*leftover, daysLeft)
	return &out
}

// PaceLine is the Pace of a month: SpentCents the cumulative spend at the end
// of each day, LineEndCents where the straight line from 0 on the first day
// ends on the last day.
type PaceLine struct {
	SpentCents   []int64
	LineEndCents int64
}

// Pace is a month's spending so far against a straight line from 0 to
// (Monthly income − Leftover) on its last day. rows are the counted Txns
// (PostedOn is the CountsOn day) of `month`; the spend is cumulative, counted as
// the daily spending is (see CumulativeDaily). The current month stops at today;
// a past month holds all its days. Nil without income or Leftover, and for a
// future month. It is not UsualPace, the average of earlier months.
func Pace(rows []Txn, income, leftover *int64, today, month time.Time) *PaceLine {
	if income == nil || leftover == nil || month.After(today) && !sameMonth(today, month) {
		return nil
	}
	spent := CumulativeDaily(rows, month)
	if sameMonth(today, month) {
		spent = spent[:today.Day()]
	}
	return &PaceLine{SpentCents: spent, LineEndCents: *income - *leftover}
}
