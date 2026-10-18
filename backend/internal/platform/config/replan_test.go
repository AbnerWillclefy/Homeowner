package config_test

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestReplanIsOffByDefault(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.ReplanEnabled {
		t.Fatal("replan should be off by default")
	}
}

func TestReplanCanBeSwitchedOn(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "REPLAN_ENABLED": "true"}))
	if err != nil {
		t.Fatal(err)
	}
	if !c.ReplanEnabled {
		t.Fatal("REPLAN_ENABLED=true should switch replan on")
	}
}

func TestReplanEnabledMustBeABool(t *testing.T) {
	_, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "REPLAN_ENABLED": "yes please"}))
	if err == nil || !strings.Contains(err.Error(), "REPLAN_ENABLED") {
		t.Fatalf("want an error naming REPLAN_ENABLED, got %v", err)
	}
}
