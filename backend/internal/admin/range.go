package admin

import (
	"errors"
	"time"
)

// ErrInvalidRange is a `range` the overview does not offer.
var ErrInvalidRange = errors.New("invalid range")

// dateLayout is how a day is written on the wire and in the SQL parameters.
const dateLayout = "2006-01-02"

// Range is how far back a report looks, in whole days.
type Range struct {
	Name string // "7d" or "30d", echoed in the response
	Days int
}

// ParseRange accepts exactly "7d" and "30d". Anything else is an error,
// an empty value included: a missing `range` is a 400, not a default of 7d,
// because the admin page always sends one and a silent default would hide a
// broken client.
func ParseRange(s string) (Range, error) {
	switch s {
	case "7d":
		return Range{Name: s, Days: 7}, nil
	case "30d":
		return Range{Name: s, Days: 30}, nil
	}
	return Range{}, ErrInvalidRange
}

// Window lists the days of the range as YYYY-MM-DD, oldest first, ending at
// the UTC date of now.
//
// The rule for Home-local dates: plan_date, checkin_date, completed_on,
// committed_on and local_date are dates in the Home's zone, so for a Home east
// of UTC they can be one day ahead of the UTC date of now. Those rows are not
// clamped into the last day: they are simply outside the window until UTC
// reaches that date, and then they appear on their own day. `from` and `to` in
// the response are the first and last entries of this list.
func (r Range) Window(now time.Time) []string {
	last := now.UTC().Truncate(24 * time.Hour)
	out := make([]string, r.Days)
	for i := range out {
		out[i] = last.AddDate(0, 0, i-r.Days+1).Format(dateLayout)
	}
	return out
}

// Previous lists the N days right before Window(now), oldest first, so the two
// windows are adjacent and never overlap: the comparison period of a report.
func (r Range) Previous(now time.Time) []string {
	first := now.UTC().Truncate(24*time.Hour).AddDate(0, 0, -2*r.Days+1)
	out := make([]string, r.Days)
	for i := range out {
		out[i] = first.AddDate(0, 0, i).Format(dateLayout)
	}
	return out
}

// ZeroFill returns one Day per entry of days, in that order, taking the
// counted day from got and an all-zero Day for a date with no data, so a chart
// has no gaps.
func ZeroFill(days []string, got map[string]Day) []Day {
	out := make([]Day, len(days))
	for i, d := range days {
		if day, ok := got[d]; ok {
			out[i] = day
		} else {
			out[i] = Day{Date: d}
		}
	}
	return out
}
