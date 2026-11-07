package config_test

import (
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLoadFinanceAllowlist(t *testing.T) {
	cases := []struct {
		name, value string
		want        []string
	}{
		{"unset", "", nil},
		{"placeholder allows nobody", "none", nil},
		{"one", "ana@example.com", []string{"ana@example.com"}},
		{"trimmed", " Ana@Example.com , B@Y.com ", []string{"Ana@Example.com", "B@Y.com"}},
		{"not an email is kept", "ana.example.com", []string{"ana.example.com"}},
		{"empty entries dropped", "a@x.com,,", []string{"a@x.com"}},
	}
	for _, tc := range cases {
		c, err := config.Load(env(withEnv("FINANCE_ALLOWLIST", tc.value)))
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if !slices.Equal(c.FinanceAllowlist, tc.want) {
			t.Errorf("%s: FinanceAllowlist = %q, want %q", tc.name, c.FinanceAllowlist, tc.want)
		}
	}
}
