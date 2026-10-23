package streak_test

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/streak"
)

// day returns a Date of March 2026 (the 2nd is a Monday).
func day(n int) allocation.Date { return allocation.NewDate(2026, time.March, n) }

func TestJudgeOneDay(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		day  streak.Day
		want streak.Outcome
	}{
		{"a Completion and no Commitments grows", streak.Day{Completions: 1}, streak.Grow},
		{"a Completion and every Commitment kept grows", streak.Day{Completions: 2}, streak.Grow},
		{"a Drained day with a Completion and nothing undone grows", streak.Day{Completions: 1, Drained: true}, streak.Grow},
		{"no Commitments and no Completion pauses", streak.Day{}, streak.Pause},
		{"a Drained day pauses", streak.Day{Drained: true}, streak.Pause},
		{"a Drained day with an undone Commitment pauses", streak.Day{Undone: 1, Drained: true}, streak.Pause},
		{"a Commitment left undone breaks", streak.Day{Undone: 1}, streak.Break},
		{"a Completion keeps the day despite a Commitment left undone", streak.Day{Completions: 3, Undone: 1}, streak.Grow},
		{"half the Commitments done grows", streak.Day{Completions: 2, Undone: 2}, streak.Grow},
		{"a Drained day with a Completion and an undone Commitment grows", streak.Day{Completions: 1, Undone: 1, Drained: true}, streak.Grow},
		{"several Commitments and no Completion breaks", streak.Day{Undone: 3}, streak.Break},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := streak.Judge(tc.day); got != tc.want {
				t.Fatalf("Judge(%+v) = %v, want %v", tc.day, got, tc.want)
			}
		})
	}
}

func TestCurrentStreak(t *testing.T) {
	t.Parallel()
	grow := func(n int) streak.Day { return streak.Day{Date: day(n), Completions: 1} }
	pause := func(n int) streak.Day { return streak.Day{Date: day(n), Drained: true} }
	brk := func(n int) streak.Day { return streak.Day{Date: day(n), Undone: 1} }
	open := streak.Day{Date: day(4), Completions: 1, Undone: 1}
	half := func(n int) streak.Day { return streak.Day{Date: day(n), Completions: 2, Undone: 2} }
	tests := []struct {
		name      string
		days      []streak.Day
		today     allocation.Date
		want      int
		wantToday bool
	}{
		{"no history is 0", nil, day(10), 0, false},
		{"grow, pause, grow counts 2", []streak.Day{grow(5), pause(6), grow(7)}, day(8), 2, false},
		{"gaps are pauses", []streak.Day{grow(2), grow(7)}, day(9), 2, false},
		{"a break resets the run", []streak.Day{grow(3), grow(4), brk(5), grow(6)}, day(7), 1, false},
		{"a break as the latest final day gives 0", []streak.Day{grow(3), brk(4)}, day(5), 0, false},
		{"days given out of order are sorted", []streak.Day{grow(7), brk(5), grow(6), grow(3)}, day(8), 2, false},
		{"today with an open Commitment does not break", []streak.Day{grow(3), brk(4)}, day(4), 1, false},
		{"today with a Completion and an open Commitment counts", []streak.Day{grow(3), open}, day(4), 2, true},
		{"a 3-day Streak then a day of 2 Completions and 2 undone Commitments reaches 4 (production report)",
			[]streak.Day{grow(2), grow(3), grow(4), half(5)}, day(6), 4, false},
		{"a partially finished day no longer breaks the run", []streak.Day{grow(3), half(4), grow(5)}, day(6), 3, false},
		{"today counts only when it grows", []streak.Day{grow(3), grow(4)}, day(4), 2, true},
		{"today with nothing pauses", []streak.Day{grow(3), pause(4)}, day(4), 1, false},
		{"days after today are ignored", []streak.Day{grow(3), grow(9)}, day(4), 1, false},
		{"today grows on top of a run", []streak.Day{grow(2), pause(3), grow(4)}, day(4), 2, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, grew := streak.Current(tc.days, tc.today)
			if got != tc.want || grew != tc.wantToday {
				t.Fatalf("Current = %d, %v; want %d, %v", got, grew, tc.want, tc.wantToday)
			}
		})
	}
}
