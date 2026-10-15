package main

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

const days = "-dir=../../internal/evals/testdata/days"

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestNoAPIKeyPrintsTheBaselineOnly(t *testing.T) {
	var out, errOut bytes.Buffer
	newClient := func(key, model string) llmalloc.Client {
		t.Fatal("the model must not be called without a key")
		return nil
	}
	if err := run(context.Background(), []string{days}, env(nil), &out, &errOut, newClient); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "llm column skipped") || !strings.Contains(out.String(), "baseline") {
		t.Errorf("output:\n%s", out.String())
	}
}

func TestBaselineOnlyIgnoresTheKey(t *testing.T) {
	var out, errOut bytes.Buffer
	newClient := func(key, model string) llmalloc.Client {
		t.Fatal("the model must not be called with -baseline-only")
		return nil
	}
	err := run(context.Background(), []string{days, "-baseline-only"}, env(map[string]string{"ANTHROPIC_API_KEY": "sk-secret"}), &out, &errOut, newClient)
	if err != nil {
		t.Fatal(err)
	}
}

func TestRunsTheModelOncePerDayAndRun(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	var gotKey, gotModel string
	newClient := func(key, model string) llmalloc.Client { gotKey, gotModel = key, model; return fake }
	var out, errOut bytes.Buffer
	e := env(map[string]string{"ANTHROPIC_API_KEY": "sk-secret", "LLM_MODEL": "some-model"})
	if err := run(context.Background(), []string{days, "-runs=2"}, e, &out, &errOut, newClient); err != nil {
		t.Fatal(err)
	}
	if fake.Calls() != 20 {
		t.Errorf("calls = %d, want 10 days x 2 runs", fake.Calls())
	}
	if gotKey != "sk-secret" || gotModel != "some-model" {
		t.Errorf("client built with %q, %q", gotKey, gotModel)
	}
	if !strings.Contains(errOut.String(), "20 model calls") {
		t.Errorf("the call count must be printed before starting:\n%s", errOut.String())
	}
	if !strings.Contains(out.String(), "model: some-model") {
		t.Errorf("header lacks the model:\n%s", out.String())
	}
	if strings.Contains(out.String()+errOut.String(), "sk-secret") {
		t.Error("the API key was printed")
	}
}

func TestRefusesTooManyCallsWithoutYes(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	newClient := func(string, string) llmalloc.Client { return fake }
	e := env(map[string]string{"ANTHROPIC_API_KEY": "k"})
	var out, errOut bytes.Buffer
	if err := run(context.Background(), []string{days, "-runs=11"}, e, &out, &errOut, newClient); err == nil {
		t.Error("want a refusal above the cap")
	}
	if fake.Calls() != 0 {
		t.Errorf("calls = %d, want 0", fake.Calls())
	}
	if err := run(context.Background(), []string{days, "-runs=11", "-yes"}, e, &out, &errOut, newClient); err != nil {
		t.Errorf("-yes should allow it: %v", err)
	}
	if fake.Calls() != 110 {
		t.Errorf("calls = %d, want 110", fake.Calls())
	}
}
