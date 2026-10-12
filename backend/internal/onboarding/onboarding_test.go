package onboarding

import (
	"slices"
	"testing"
)

func TestStepsAreInTheTicketsOrder(t *testing.T) {
	want := []string{"install", "reminders", "baseline", "restrictions", "preferences", "home"}
	if got := Steps(); !slices.Equal(got, want) {
		t.Errorf("Steps() = %v, want %v", got, want)
	}
}

func TestNextIsTheStepAfterTheStoredOne(t *testing.T) {
	cases := []struct{ stored, want string }{
		{"", "install"},
		{"install", "reminders"},
		{"reminders", "baseline"},
		{"baseline", "restrictions"},
		{"restrictions", "preferences"},
		{"preferences", "home"},
		{"home", "done"},
		{"done", "done"},
		{"from-a-newer-release", "install"},
	}
	for _, c := range cases {
		if got := Next(c.stored); got != c.want {
			t.Errorf("Next(%q) = %q, want %q", c.stored, got, c.want)
		}
	}
}

func TestOnlyTheFirstFiveStepsCanBeWrittenByHand(t *testing.T) {
	cases := map[string]bool{
		"install": true, "reminders": true, "baseline": true, "restrictions": true, "preferences": true,
		"home": false, "done": false, "": false, "Install": false, "unknown": false,
	}
	for step, want := range cases {
		if got := Valid(step); got != want {
			t.Errorf("Valid(%q) = %v, want %v", step, got, want)
		}
	}
}

func TestBeforeListsWhatAStepMayMoveForwardFrom(t *testing.T) {
	cases := []struct {
		step string
		want []string
	}{
		{"install", []string{}},
		{"reminders", []string{"install"}},
		{"preferences", []string{"install", "reminders", "baseline", "restrictions"}},
		{"done", []string{"install", "reminders", "baseline", "restrictions", "preferences", "home"}},
		{"unknown", nil},
	}
	for _, c := range cases {
		if got := Before(c.step); !slices.Equal(got, c.want) {
			t.Errorf("Before(%q) = %v, want %v", c.step, got, c.want)
		}
	}
}
