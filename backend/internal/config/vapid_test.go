package config_test

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/config"
)

func TestVAPIDIsOptionalAsASet(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.VAPIDEnabled() {
		t.Fatal("push should be disabled without keys")
	}
}

func TestVAPIDBothKeysEnablePush(t *testing.T) {
	c, err := config.Load(env(map[string]string{
		"DATABASE_URL":      "postgres://x",
		"VAPID_PUBLIC_KEY":  "pub",
		"VAPID_PRIVATE_KEY": "priv",
		"VAPID_SUBJECT":     "mailto:ops@example.com",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !c.VAPIDEnabled() || c.VAPIDPublicKey != "pub" || c.VAPIDPrivateKey != "priv" || c.VAPIDSubject != "mailto:ops@example.com" {
		t.Fatalf("unexpected config: %+v", c)
	}
}

func TestVAPIDExactlyOneKeyIsAnError(t *testing.T) {
	for name, env_ := range map[string]map[string]string{
		"only public":  {"VAPID_PUBLIC_KEY": "pub"},
		"only private": {"VAPID_PRIVATE_KEY": "priv"},
	} {
		env_["DATABASE_URL"] = "postgres://x"
		_, err := config.Load(env(env_))
		if err == nil || !strings.Contains(err.Error(), "VAPID") {
			t.Errorf("%s: want a VAPID error, got %v", name, err)
		}
	}
}

func TestVAPIDKeysNeedASubject(t *testing.T) {
	_, err := config.Load(env(map[string]string{
		"DATABASE_URL":      "postgres://x",
		"VAPID_PUBLIC_KEY":  "pub",
		"VAPID_PRIVATE_KEY": "priv",
	}))
	if err == nil || !strings.Contains(err.Error(), "VAPID_SUBJECT") {
		t.Fatalf("want a VAPID_SUBJECT error, got %v", err)
	}
}
