package config_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func withEnv(kv ...string) map[string]string {
	m := map[string]string{"DATABASE_URL": "x"}
	for i := 0; i+1 < len(kv); i += 2 {
		m[kv[i]] = kv[i+1]
	}
	return m
}

func TestLoadCognitoIsOffWhenNeitherIsSet(t *testing.T) {
	c, err := config.Load(env(withEnv()))
	if err != nil || c.AuthEnabled() {
		t.Fatalf("err = %v, enabled = %v, want no error and auth off", err, c.AuthEnabled())
	}
}

func TestLoadCognitoPairIsReadAndTheIssuerTrimmed(t *testing.T) {
	const issuer = "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_abc"

	c, err := config.Load(env(withEnv("COGNITO_ISSUER", issuer+"/", "COGNITO_CLIENT_ID", "client1")))

	if err != nil || !c.AuthEnabled() || c.CognitoIssuer != issuer || c.CognitoClientID != "client1" {
		t.Fatalf("%+v, err = %v, want auth on with the trailing slash trimmed", c, err)
	}
}

func TestLoadCognitoRejectsHalfAPairAndBadIssuers(t *testing.T) {
	for name, m := range map[string]map[string]string{
		"issuer only":      withEnv("COGNITO_ISSUER", "https://cognito-idp.eu-west-1.amazonaws.com/p"),
		"client id only":   withEnv("COGNITO_CLIENT_ID", "client1"),
		"http issuer":      withEnv("COGNITO_ISSUER", "http://cognito-idp.example.com/p", "COGNITO_CLIENT_ID", "c"),
		"issuer not a url": withEnv("COGNITO_ISSUER", "nonsense", "COGNITO_CLIENT_ID", "c"),
	} {
		if _, err := config.Load(env(m)); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}
