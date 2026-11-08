package pluggy

import "testing"

func TestParseCents(t *testing.T) {
	cases := []struct {
		in   string
		want int64
		ok   bool
	}{
		{"0.29", 29, true}, // 0.29*100 is 28.999... in float64
		{"-21.9", -2190, true},
		{"100", 10000, true},
		{"-0.05", -5, true},
		{"1234.50", 123450, true},
		{"0", 0, true},
		{"1.234", 0, false},
		{"1.", 0, false},
		{".5", 0, false},
		{"", 0, false},
		{"-", 0, false},
		{"1e2", 0, false},
		{"abc", 0, false},
		{"--1", 0, false},
		{"+1", 0, false},
		{"99999999999999999999", 0, false},
	}
	for _, tc := range cases {
		got, err := parseCents(tc.in)
		if (err == nil) != tc.ok || got != tc.want {
			t.Errorf("parseCents(%q) = %d, %v; want %d, ok=%v", tc.in, got, err, tc.want, tc.ok)
		}
	}
}
