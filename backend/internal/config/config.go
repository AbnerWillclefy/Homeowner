// Package config reads the process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"strconv"
)

// Config is everything the API needs from its environment.
type Config struct {
	DatabaseURL string
	// MigrateDatabaseURL is the direct (non-pooled) URL used for migrations.
	// Neon's pooled URLs can break migrations, so it falls back to DatabaseURL.
	MigrateDatabaseURL string
	Port               string
	MigrateOnStart     bool
	DBMaxConns         int32
}

// Load builds a Config from getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	c := Config{
		DatabaseURL:        getenv("DATABASE_URL"),
		MigrateDatabaseURL: getenv("MIGRATE_DATABASE_URL"),
		Port:               getenv("PORT"),
		DBMaxConns:         5,
	}
	if c.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if c.MigrateDatabaseURL == "" {
		c.MigrateDatabaseURL = c.DatabaseURL
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	if v := getenv("MIGRATE_ON_START"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("MIGRATE_ON_START: %w", err)
		}
		c.MigrateOnStart = b
	}
	if v := getenv("DB_MAX_CONNS"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil || n < 1 {
			return Config{}, fmt.Errorf("DB_MAX_CONNS must be a positive integer, got %q", v)
		}
		c.DBMaxConns = int32(n)
	}
	return c, nil
}
