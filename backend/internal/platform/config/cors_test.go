package config_test

import (
	"slices"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestLoadCORSAllowedOriginsDefaultsToNone(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.CORSAllowedOrigins) != 0 {
		t.Fatalf("CORSAllowedOrigins = %q, want none", c.CORSAllowedOrigins)
	}
}

func TestLoadCORSAllowedOriginsSplitsAndTrims(t *testing.T) {
	c, err := config.Load(env(map[string]string{
		"DATABASE_URL":         "postgres://x",
		"CORS_ALLOWED_ORIGINS": " http://localhost:5173, https://app.example.com ,,",
	}))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"http://localhost:5173", "https://app.example.com"}
	if !slices.Equal(c.CORSAllowedOrigins, want) {
		t.Fatalf("CORSAllowedOrigins = %q, want %q", c.CORSAllowedOrigins, want)
	}
}
