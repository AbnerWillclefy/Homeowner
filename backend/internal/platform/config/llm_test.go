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

func TestLLMMonthlySpendLimitIsUnsetByDefault(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.LLMMonthlySpendLimitMicros != 0 {
		t.Fatalf("limit = %d, want 0 (no limit configured)", c.LLMMonthlySpendLimitMicros)
	}
}

func TestLLMMonthlySpendLimitIsStoredAsMicroUSD(t *testing.T) {
	for in, want := range map[string]int64{
		"10":        10_000_000,
		"10.5":      10_500_000,
		"0.000001":  1,
		" 20.25 ":   20_250_000,
		"1234.0010": 1_234_001_000,
	} {
		c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "LLM_MONTHLY_SPEND_LIMIT_USD": in}))
		if err != nil {
			t.Errorf("%q: %v", in, err)
			continue
		}
		if c.LLMMonthlySpendLimitMicros != want {
			t.Errorf("%q = %d micro-USD, want %d", in, c.LLMMonthlySpendLimitMicros, want)
		}
	}
}

func TestLLMMonthlySpendLimitMustBeAPositiveDecimal(t *testing.T) {
	for _, in := range []string{"0", "0.0", "-5", "ten", "1e3", "1.2.3", "$10", "0.0000001", ".", "7.", "99999999999999999999"} {
		_, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x", "LLM_MONTHLY_SPEND_LIMIT_USD": in}))
		if err == nil || !strings.Contains(err.Error(), "LLM_MONTHLY_SPEND_LIMIT_USD") {
			t.Errorf("%q: want an error naming LLM_MONTHLY_SPEND_LIMIT_USD, got %v", in, err)
		}
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
