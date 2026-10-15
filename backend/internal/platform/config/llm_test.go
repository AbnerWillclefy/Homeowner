package config_test

import (
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLLMAllocatorIsOffByDefault(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.LLMAllocatorEnabled {
		t.Fatal("the LLM allocator should be off by default")
	}
	if c.LLMModel != "claude-haiku-5-5" || c.LLMDailyCapPerHome != 3 || c.LLMTimeout != 15*time.Second {
		t.Fatalf("unexpected LLM defaults: model %q, cap %d, timeout %s", c.LLMModel, c.LLMDailyCapPerHome, c.LLMTimeout)
	}
}

func TestLLMAllocatorOverrides(t *testing.T) {
	c, err := config.Load(env(map[string]string{
		"DATABASE_URL":           "postgres://x",
		"LLM_ALLOCATOR_ENABLED":  "true",
		"ANTHROPIC_API_KEY":      "sk-test",
		"LLM_MODEL":              "claude-other",
		"LLM_DAILY_CAP_PER_HOME": "5",
		"LLM_TIMEOUT_SECONDS":    "10",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !c.LLMAllocatorEnabled || c.AnthropicAPIKey != "sk-test" || c.LLMModel != "claude-other" ||
		c.LLMDailyCapPerHome != 5 || c.LLMTimeout != 10*time.Second {
		t.Fatalf("unexpected config: %+v", c)
	}
}

func TestLLMAllocatorEnabledNeedsAKey(t *testing.T) {
	_, err := config.Load(env(map[string]string{
		"DATABASE_URL":          "postgres://x",
		"LLM_ALLOCATOR_ENABLED": "true",
	}))
	if err == nil || !strings.Contains(err.Error(), "ANTHROPIC_API_KEY") {
		t.Fatalf("want an ANTHROPIC_API_KEY error, got %v", err)
	}
}

func TestLLMSettingsMustBeValid(t *testing.T) {
	for name, kv := range map[string][2]string{
		"enabled not a bool": {"LLM_ALLOCATOR_ENABLED", "yes please"},
		"cap zero":           {"LLM_DAILY_CAP_PER_HOME", "0"},
		"cap not a number":   {"LLM_DAILY_CAP_PER_HOME", "three"},
		"timeout zero":       {"LLM_TIMEOUT_SECONDS", "0"},
		"timeout negative":   {"LLM_TIMEOUT_SECONDS", "-1"},
	} {
		_, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", kv[0]: kv[1]}))
		if err == nil || !strings.Contains(err.Error(), kv[0]) {
			t.Errorf("%s: want an error naming %s, got %v", name, kv[0], err)
		}
	}
}
