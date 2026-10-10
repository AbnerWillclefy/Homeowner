package config_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/config"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDefaults(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "8080" || c.MigrateOnStart || c.DBMaxConns != 5 {
		t.Fatalf("unexpected defaults: %+v", c)
	}
	if c.MigrateDatabaseURL != "postgres://x" {
		t.Fatalf("MigrateDatabaseURL = %q, want fallback to DATABASE_URL", c.MigrateDatabaseURL)
	}
}

func TestLoadOverrides(t *testing.T) {
	c, err := config.Load(env(map[string]string{
		"DATABASE_URL":         "postgres://pooled",
		"MIGRATE_DATABASE_URL": "postgres://direct",
		"PORT":                 "9000",
		"MIGRATE_ON_START":     "true",
		"DB_MAX_CONNS":         "3",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "9000" || !c.MigrateOnStart || c.DBMaxConns != 3 || c.MigrateDatabaseURL != "postgres://direct" {
		t.Fatalf("unexpected config: %+v", c)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	if _, err := config.Load(env(nil)); err == nil {
		t.Fatal("expected error when DATABASE_URL is missing")
	}
}

func TestLoadRejectsBadValues(t *testing.T) {
	for name, m := range map[string]map[string]string{
		"bad bool": {"DATABASE_URL": "x", "MIGRATE_ON_START": "maybe"},
		"bad int":  {"DATABASE_URL": "x", "DB_MAX_CONNS": "many"},
		"zero int": {"DATABASE_URL": "x", "DB_MAX_CONNS": "0"},
	} {
		if _, err := config.Load(env(m)); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}
