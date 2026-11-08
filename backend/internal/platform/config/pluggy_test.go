package config_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLoadPluggyBaseURL(t *testing.T) {
	cases := []struct {
		name, value, want string
		wantErr           bool
	}{
		{"default", "", "https://api.pluggy.ai", false},
		{"override, trailing slash trimmed", " http://localhost:9000/ ", "http://localhost:9000", false},
		{"not a url", "api.pluggy.ai", "", true},
	}
	for _, tc := range cases {
		c, err := config.Load(env(withEnv("PLUGGY_BASE_URL", tc.value)))
		if (err != nil) != tc.wantErr || c.PluggyBaseURL != tc.want {
			t.Errorf("%s: PluggyBaseURL = %q, err = %v", tc.name, c.PluggyBaseURL, err)
		}
	}
}
