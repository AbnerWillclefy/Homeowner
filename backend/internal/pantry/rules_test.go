package pantry

import (
	"testing"
	"time"
)

func day(d int) *time.Time {
	t := time.Date(2026, 11, d, 0, 0, 0, 0, time.UTC)
	return &t
}

func TestStateOf(t *testing.T) {
	cases := []struct {
		name             string
		purchase, ranOut *time.Time
		want             string
	}{
		{"no run-out", nil, nil, InStock},
		{"no run-out, a purchase", day(5), nil, InStock},
		{"run-out, no purchase", nil, day(5), RanOut},
		{"run-out after the purchase", day(3), day(5), RanOut},
		{"run-out before the purchase", day(5), day(3), InStock},
		{"run-out on the day of the purchase", day(5), day(5), InStock},
	}
	for _, c := range cases {
		if got := StateOf(c.purchase, c.ranOut); got != c.want {
			t.Errorf("%s: StateOf = %s, want %s", c.name, got, c.want)
		}
	}
}

func TestLineKey(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Leite  Integral 1L", "LEITE INTEGRAL 1L"},
		{"  Açúcar   Refinado ", "ACUCAR REFINADO"},
		{"LEITE 1L", "LEITE 1L"},
		{"LEITE 5L", "LEITE 5L"},
		{"pão de açaí", "PAO DE ACAI"},
		{"MARG.PRIMOR C/S", "MARG.PRIMOR C/S"},
	}
	for _, c := range cases {
		if got := LineKey(c.in); got != c.want {
			t.Errorf("LineKey(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
