package schedule

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// d is a March 2026 date. 2026-03-01 is a Sunday.
func d(day int) allocation.Date { return allocation.NewDate(2026, time.March, day) }

func intp(n int) *int { return &n }

func TestFirstWindowOpensOnCreationDate(t *testing.T) {
	c := Chore{IntervalDays: intp(3), BaseEffort: 2, Created: d(10)}
	got := Decide(c, nil, d(10))
	want := Decision{Action: Open, WindowStart: d(10), WindowEnd: d(12), Effort: 2}
	if got != want {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}
