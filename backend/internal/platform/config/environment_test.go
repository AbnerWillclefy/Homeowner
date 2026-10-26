package config_test

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLoadEnvironment(t *testing.T) {
	cases := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{"unset defaults to local", "", "local", false},
		{"local", "local", "local", false},
		{"staging", "staging", "staging", false},
		{"production", "production", "production", false},
		{"surrounding spaces trimmed", " staging ", "staging", false},
		{"unknown value", "prod", "", true},
		{"wrong case", "Staging", "", true},
	}
	for _, tc := range cases {
		c, err := config.Load(env(withEnv("ENVIRONMENT", tc.value)))

		if tc.wantErr {
			if err == nil || !strings.Contains(err.Error(), "ENVIRONMENT") {
				t.Errorf("%s: err = %v, want one naming ENVIRONMENT", tc.name, err)
			}
			continue
		}
		if err != nil || c.Environment != tc.want {
			t.Errorf("%s: environment = %q, err = %v, want %q", tc.name, c.Environment, err, tc.want)
		}
	}
}
