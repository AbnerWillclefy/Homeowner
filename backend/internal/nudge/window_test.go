package nudge

import "testing"

func TestInReminderWindow(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name         string
		local, alloc int
		want         bool
	}{
		{"a minute before the moment", 6*60 - 1, 7 * 60, false},
		{"at the moment", 6 * 60, 7 * 60, true},
		{"late tick inside the window", 6*60 + 40, 7 * 60, true},
		{"at the Allocation time", 7 * 60, 7 * 60, false},
		{"after the Allocation time", 7*60 + 5, 7 * 60, false},
		{"early morning Allocation clamps to midnight", 0, 30, true},
		{"early morning window closes at the time", 30, 30, false},
		{"midnight Allocation has no window", 0, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := inReminderWindow(tc.local, tc.alloc); got != tc.want {
				t.Fatalf("inReminderWindow(%d, %d) = %v, want %v", tc.local, tc.alloc, got, tc.want)
			}
		})
	}
}
