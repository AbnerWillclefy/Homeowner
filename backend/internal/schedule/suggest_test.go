package schedule

import "testing"

func TestSuggestsTwoPerson(t *testing.T) {
	repeats := Chore{BuildsUp: true, IntervalDays: intp(7)}
	for _, tc := range []struct {
		name   string
		chore  Chore
		people int
		effort int
		want   bool
	}{
		{"builds up, repeats, one person, at the cap", repeats, 1, MaxEffort, true},
		{"below the cap", repeats, 1, MaxEffort - 1, false},
		{"already two-person", repeats, 2, MaxEffort, false},
		{"one-off", Chore{BuildsUp: true}, 1, MaxEffort, false},
		{"does not build up", Chore{IntervalDays: intp(7)}, 1, MaxEffort, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := SuggestsTwoPerson(tc.chore, tc.people, tc.effort); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}
