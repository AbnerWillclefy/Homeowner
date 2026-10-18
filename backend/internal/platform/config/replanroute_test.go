package config_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestReplanAllocateFunctionIsOffByDefault(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.ReplanAllocateFunction != "" {
		t.Fatalf("the replan route should be off by default, got %q", c.ReplanAllocateFunction)
	}
}

func TestReplanAllocateFunctionIsTrimmed(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "REPLAN_ALLOCATE_FUNCTION_NAME": "  homeowner-staging-allocate \n"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.ReplanAllocateFunction != "homeowner-staging-allocate" {
		t.Fatalf("got %q", c.ReplanAllocateFunction)
	}
}

func TestReplanAllocateFunctionBlankMeansOff(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "REPLAN_ALLOCATE_FUNCTION_NAME": "   "}))
	if err != nil {
		t.Fatal(err)
	}
	if c.ReplanAllocateFunction != "" {
		t.Fatalf("blank should be off, got %q", c.ReplanAllocateFunction)
	}
}
