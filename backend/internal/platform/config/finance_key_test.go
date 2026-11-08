package config_test

import (
	"bytes"
	"encoding/base64"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLoadFinanceKey(t *testing.T) {
	raw := bytes.Repeat([]byte{7}, 32)
	cases := []struct {
		name, value string
		want        []byte
	}{
		{"unset", "", nil},
		{"valid", base64.StdEncoding.EncodeToString(raw), raw},
		{"padded with whitespace", " " + base64.StdEncoding.EncodeToString(raw) + "\n", raw},
		{"not base64", "not base64!", nil},
		{"too short", base64.StdEncoding.EncodeToString(raw[:16]), nil},
		{"too long", base64.StdEncoding.EncodeToString(append(raw, 1)), nil},
	}
	for _, tc := range cases {
		c, err := config.Load(env(withEnv("FINANCE_ENCRYPTION_KEY", tc.value)))
		if err != nil {
			t.Fatalf("%s: Load must not fail: %v", tc.name, err)
		}
		if tc.want == nil && c.FinanceKey != nil || tc.want != nil && (c.FinanceKey == nil || !bytes.Equal(c.FinanceKey[:], tc.want)) {
			t.Errorf("%s: FinanceKey = %v", tc.name, c.FinanceKey)
		}
	}
}
