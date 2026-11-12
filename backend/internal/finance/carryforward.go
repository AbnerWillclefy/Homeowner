package finance

import "time"

// Point is a value written on a day (a UTC midnight).
type Point[V any] struct {
	Day   time.Time
	Value V
}

// CarryForward gives one value per day from..to inclusive: the point written
// that day, else the last one before it, else nil. points must be sorted by day.
func CarryForward[V any](points []Point[V], from, to time.Time) []*V {
	out := []*V{}
	i := 0
	var last *V
	for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
		for i < len(points) && !points[i].Day.After(day) {
			last = &points[i].Value
			i++
		}
		out = append(out, last)
	}
	return out
}
