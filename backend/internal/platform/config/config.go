// Package config reads the process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// The LLM allocator's defaults, exported so cmd/evals tests what production runs.
const (
	DefaultLLMModel   = "claude-haiku-5-5"
	DefaultLLMTimeout = 15 * time.Second
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
	// CognitoIssuer and CognitoClientID identify the user pool and app client
	// whose ID tokens the API accepts. Optional as a pair: with neither set,
	// auth is off and routes that need a signed-in User answer 503. They are
	// public identifiers, not secrets.
	CognitoIssuer   string
	CognitoClientID string
	// LLMAllocatorEnabled lets the daily Allocation ask the LLM allocator first
	// (ADR 0004). Off by default; on, it needs AnthropicAPIKey.
	LLMAllocatorEnabled bool
	AnthropicAPIKey     string
	LLMModel            string
	// LLMDailyCapPerHome is how many LLM calls one Home may make per local day.
	LLMDailyCapPerHome int
	// LLMTimeout bounds one LLM call.
	LLMTimeout time.Duration
}

// AuthEnabled reports whether sign-in is configured.
func (c Config) AuthEnabled() bool { return c.CognitoIssuer != "" && c.CognitoClientID != "" }

// VAPIDEnabled reports whether push is configured.
func (c Config) VAPIDEnabled() bool { return c.VAPIDPublicKey != "" && c.VAPIDPrivateKey != "" }

// Load builds a Config from getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	c := Config{
		DatabaseURL:        getenv("DATABASE_URL"),
		MigrateDatabaseURL: getenv("MIGRATE_DATABASE_URL"),
		Port:               getenv("PORT"),
		DBMaxConns:         5,
		LLMModel:           DefaultLLMModel,
		LLMDailyCapPerHome: 3,
		LLMTimeout:         DefaultLLMTimeout,
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
	c.CognitoIssuer = strings.TrimRight(strings.TrimSpace(getenv("COGNITO_ISSUER")), "/")
	c.CognitoClientID = strings.TrimSpace(getenv("COGNITO_CLIENT_ID"))
	if (c.CognitoIssuer == "") != (c.CognitoClientID == "") {
		return Config{}, errors.New("COGNITO_ISSUER and COGNITO_CLIENT_ID must be set together")
	}
	if c.CognitoIssuer != "" {
		u, err := url.Parse(c.CognitoIssuer)
		if err != nil || u.Scheme != "https" || u.Host == "" {
			return Config{}, errors.New("COGNITO_ISSUER must be an https URL")
		}
	}
	if err := loadLLM(getenv, &c); err != nil {
		return Config{}, err
	}
	return c, nil
}

// loadLLM reads the LLM allocator settings into c. Errors name the variable,
// never the key.
func loadLLM(getenv func(string) string, c *Config) error {
	if v := getenv("LLM_ALLOCATOR_ENABLED"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("LLM_ALLOCATOR_ENABLED: %w", err)
		}
		c.LLMAllocatorEnabled = b
	}
	c.AnthropicAPIKey = getenv("ANTHROPIC_API_KEY")
	if c.LLMAllocatorEnabled && c.AnthropicAPIKey == "" {
		return errors.New("ANTHROPIC_API_KEY is required when LLM_ALLOCATOR_ENABLED is true")
	}
	if v := getenv("LLM_MODEL"); v != "" {
		c.LLMModel = v
	}
	if v := getenv("LLM_DAILY_CAP_PER_HOME"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return fmt.Errorf("LLM_DAILY_CAP_PER_HOME must be a positive integer, got %q", v)
		}
		c.LLMDailyCapPerHome = n
	}
	if v := getenv("LLM_TIMEOUT_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return fmt.Errorf("LLM_TIMEOUT_SECONDS must be a positive integer, got %q", v)
		}
		c.LLMTimeout = time.Duration(n) * time.Second
	}
	return nil
}
