package finance

import "time"

// parseMonth reads YYYY-MM within 2000-01..2100-12 and returns the first day of
// that month and of the next, both UTC midnights, for a [from, to) range.
func parseMonth(v string) (from, to time.Time, ok bool) {
	from, err := time.Parse("2006-01", v)
	if err != nil || from.Year() < 2000 || from.Year() > 2100 {
		return from, to, false
	}
	return from, from.AddDate(0, 1, 0), true
}
