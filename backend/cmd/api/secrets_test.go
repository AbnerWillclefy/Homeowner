package main

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"github.com/aws/aws-sdk-go-v2/service/ssm/types"
)

type fakeSSM struct {
	params map[string]string
	calls  []string
}

func (f *fakeSSM) GetParameter(_ context.Context, in *ssm.GetParameterInput, _ ...func(*ssm.Options)) (*ssm.GetParameterOutput, error) {
	name := *in.Name
	f.calls = append(f.calls, name)
	if in.WithDecryption == nil || !*in.WithDecryption {
		return nil, errors.New("fake: decryption not requested")
	}
	v, ok := f.params[name]
	if !ok {
		return nil, &types.ParameterNotFound{}
	}
	return &ssm.GetParameterOutput{Parameter: &types.Parameter{Value: &v}}, nil
}

func envOf(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestSecretsResolvedFromSSMWhenParameterNamesAreSet(t *testing.T) {
	fake := &fakeSSM{params: map[string]string{
		"/p/db":      "postgres://pooled",
		"/p/migrate": "postgres://direct",
	}}
	getenv, err := withSSMSecrets(context.Background(), fake, envOf(map[string]string{
		"DATABASE_URL_SSM_PARAM":         "/p/db",
		"MIGRATE_DATABASE_URL_SSM_PARAM": "/p/migrate",
		"PORT":                           "8080",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if got := getenv("DATABASE_URL"); got != "postgres://pooled" {
		t.Errorf("DATABASE_URL = %q", got)
	}
	if got := getenv("MIGRATE_DATABASE_URL"); got != "postgres://direct" {
		t.Errorf("MIGRATE_DATABASE_URL = %q", got)
	}
	if got := getenv("PORT"); got != "8080" {
		t.Errorf("other variables must pass through, PORT = %q", got)
	}
}

func TestVAPIDPrivateKeyResolvedFromSSM(t *testing.T) {
	fake := &fakeSSM{params: map[string]string{"/p/vapid": "private-key-value"}}
	getenv, err := withSSMSecrets(context.Background(), fake, envOf(map[string]string{
		"VAPID_PRIVATE_KEY_SSM_PARAM": "/p/vapid",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if got := getenv("VAPID_PRIVATE_KEY"); got != "private-key-value" {
		t.Errorf("VAPID_PRIVATE_KEY = %q", got)
	}
}

func TestAnthropicAPIKeyResolvedFromSSM(t *testing.T) {
	fake := &fakeSSM{params: map[string]string{"/p/anthropic": "anthropic-key-value"}}
	getenv, err := withSSMSecrets(context.Background(), fake, envOf(map[string]string{
		"ANTHROPIC_API_KEY_SSM_PARAM": "/p/anthropic",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if got := getenv("ANTHROPIC_API_KEY"); got != "anthropic-key-value" {
		t.Errorf("ANTHROPIC_API_KEY = %q", got)
	}
}

func TestMissingParameterErrorNamesParameterButNotAnyValue(t *testing.T) {
	fake := &fakeSSM{params: map[string]string{"/p/migrate": "postgres://secret-direct"}}
	_, err := withSSMSecrets(context.Background(), fake, envOf(map[string]string{
		"DATABASE_URL_SSM_PARAM":         "/p/missing",
		"MIGRATE_DATABASE_URL_SSM_PARAM": "/p/migrate",
	}))
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "/p/missing") {
		t.Errorf("error should name the parameter: %v", err)
	}
	if strings.Contains(err.Error(), "secret-direct") {
		t.Errorf("error leaks a value: %v", err)
	}
}

func TestPlainVariableWinsAndSkipsSSM(t *testing.T) {
	fake := &fakeSSM{params: map[string]string{"/p/db": "postgres://from-ssm"}}
	getenv, err := withSSMSecrets(context.Background(), fake, envOf(map[string]string{
		"DATABASE_URL":           "postgres://plain",
		"DATABASE_URL_SSM_PARAM": "/p/db",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if got := getenv("DATABASE_URL"); got != "postgres://plain" {
		t.Errorf("DATABASE_URL = %q, want plain value", got)
	}
	if len(fake.calls) != 0 {
		t.Errorf("SSM should not be called, got %v", fake.calls)
	}
}

func TestNoParameterNamesMeansNoSSMCalls(t *testing.T) {
	fake := &fakeSSM{}
	if _, err := withSSMSecrets(context.Background(), fake, envOf(nil)); err != nil {
		t.Fatal(err)
	}
	if len(fake.calls) != 0 {
		t.Errorf("unexpected calls %v", fake.calls)
	}
}
