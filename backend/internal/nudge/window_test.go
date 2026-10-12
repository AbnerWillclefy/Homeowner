package nudge

import (
	"testing"
	"time"
)

func TestInReminderWindow(t *testing.T) {
	t.Parallel()
	const h, m = time.Hour, time.Minute
	tests := []struct {
		name         string
		local, alloc time.Duration
		want         bool
	}{
		{"a minute before the moment", 6*h - m, 7 * h, false},
		{"at the moment", 6 * h, 7 * h, true},
		{"late tick inside the window", 6*h + 40*m, 7 * h, true},
		{"at the Allocation time", 7 * h, 7 * h, false},
		{"after the Allocation time", 7*h + 5*m, 7 * h, false},
		{"early morning Allocation clamps to midnight", 0, 30 * m, true},
		{"early morning window closes at the time", 30 * m, 30 * m, false},
		{"midnight Allocation has no window", 0, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := inReminderWindow(tc.local, tc.alloc); got != tc.want {
				t.Fatalf("inReminderWindow(%v, %v) = %v, want %v", tc.local, tc.alloc, got, tc.want)
			}
		})
	}
}
