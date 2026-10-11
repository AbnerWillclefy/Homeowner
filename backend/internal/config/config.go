// Package config reads the process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
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
	// CORSAllowedOrigins are the browser origins allowed to call the API.
	// Empty means no CORS headers are sent.
	CORSAllowedOrigins []string
	// VAPID keys and subject for Web Push. Optional as a set: with neither key
	// set, push is disabled and the /push/* routes answer 503.
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
}

// VAPIDEnabled reports whether push is configured.
func (c Config) VAPIDEnabled() bool { return c.VAPIDPublicKey != "" && c.VAPIDPrivateKey != "" }

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
	for _, o := range strings.Split(getenv("CORS_ALLOWED_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSAllowedOrigins = append(c.CORSAllowedOrigins, o)
		}
	}
	c.VAPIDPublicKey = getenv("VAPID_PUBLIC_KEY")
	c.VAPIDPrivateKey = getenv("VAPID_PRIVATE_KEY")
	c.VAPIDSubject = getenv("VAPID_SUBJECT")
	if (c.VAPIDPublicKey == "") != (c.VAPIDPrivateKey == "") {
		return Config{}, errors.New("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together")
	}
	if c.VAPIDEnabled() && c.VAPIDSubject == "" {
		return Config{}, errors.New("VAPID_SUBJECT is required when the VAPID keys are set (for example mailto:you@example.com)")
	}
	return c, nil
}
