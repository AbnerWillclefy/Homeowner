package finance

import (
	"slices"
	"testing"
	"time"
)

func TestCarryForward(t *testing.T) {
	t.Parallel()
	d := func(day int) time.Time { return time.Date(2026, time.November, day, 0, 0, 0, 0, time.UTC) }
	ptr := func(v int64) *int64 { return &v }
	for name, c := range map[string]struct {
		points   []Point[int64]
		from, to time.Time
		want     []*int64
	}{
		"a gap day takes the last value": {[]Point[int64]{{d(1), 10}, {d(4), 40}}, d(1), d(5), []*int64{ptr(10), ptr(10), ptr(10), ptr(40), ptr(40)}},
		"before the first write nothing": {[]Point[int64]{{d(3), 30}}, d(1), d(4), []*int64{nil, nil, ptr(30), ptr(30)}},
		"a single point":                 {[]Point[int64]{{d(2), 0}}, d(2), d(3), []*int64{ptr(0), ptr(0)}},
		"a range starting mid-history":   {[]Point[int64]{{d(1), 10}, {d(3), 30}, {d(6), 60}}, d(4), d(6), []*int64{ptr(30), ptr(30), ptr(60)}},
		"no points":                      {nil, d(1), d(2), []*int64{nil, nil}},
		"to before from":                 {[]Point[int64]{{d(1), 10}}, d(3), d(2), []*int64{}},
	} {
		got := CarryForward(c.points, c.from, c.to)
		if !slices.EqualFunc(got, c.want, func(a, b *int64) bool { return (a == nil) == (b == nil) && (a == nil || *a == *b) }) {
			t.Errorf("%s: got %v, want %v", name, got, c.want)
		}
	}
}
