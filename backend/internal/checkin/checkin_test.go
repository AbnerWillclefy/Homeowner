package checkin_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

func TestScaleRoundsDownAndNeverInventsEnergy(t *testing.T) {
	t.Parallel()
	tests := []struct {
		level checkin.Level
		base  int
		want  int
	}{
		{checkin.Drained, 5, 0},
		{checkin.Drained, 0, 0},
		{checkin.Low, 5, 2}, // 50% of 5 is 2.5, floored
		{checkin.Low, 3, 1},
		{checkin.Low, 1, 0},
		{checkin.Low, 10, 5},
		{checkin.Normal, 5, 5},
		{checkin.Normal, 0, 0},
		{checkin.Energized, 5, 6}, // 6.5 floored
		{checkin.Energized, 3, 3}, // 3.9 floored
		{checkin.Energized, 1, 1}, // 1.3 floored
		{checkin.Energized, 10, 13},
		{checkin.Energized, 20, 26},
		{checkin.Low, 0, 0},
		{checkin.Energized, 0, 0},
	}
	for _, tt := range tests {
		if got := checkin.Scale(tt.base, tt.level); got != tt.want {
			t.Errorf("Scale(%d, %s) = %d, want %d", tt.base, tt.level, got, tt.want)
		}
	}
}

func TestScaleStaysOrderedForEveryBaseline(t *testing.T) {
	t.Parallel()
	for base := 0; base <= profile.MaxBaseline; base++ {
		d, l, n, e := checkin.Scale(base, checkin.Drained), checkin.Scale(base, checkin.Low),
			checkin.Scale(base, checkin.Normal), checkin.Scale(base, checkin.Energized)
		if d != 0 || n != base || !(d <= l && l <= n && n <= e) {
			t.Errorf("base %d: drained=%d low=%d normal=%d energized=%d", base, d, l, n, e)
		}
	}
}

func TestOnlyTheFourLevelsAreValid(t *testing.T) {
	t.Parallel()
	for _, id := range []string{"drained", "low", "normal", "energized"} {
		if !checkin.Level(id).Valid() {
			t.Errorf("%q should be valid", id)
		}
	}
	for _, id := range []string{"", "Low", "tired", "high"} {
		if checkin.Level(id).Valid() {
			t.Errorf("%q should be invalid", id)
		}
	}
	if got := checkin.Scale(5, checkin.Level("tired")); got != 0 {
		t.Errorf("unknown level scaled to %d, want 0", got)
	}
}
