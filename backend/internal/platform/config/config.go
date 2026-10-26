// Package config reads the process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"math"
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
	// LLMMonthlySpendLimitMicros (LLM_MONTHLY_SPEND_LIMIT_USD) is the Anthropic
	// Console's monthly spend limit in micro-USD, so it compares exactly with
	// est_cost_micros. Zero means none is configured. It is display-only: the
	// admin page shows month-to-date cost against it and no code enforces it.
	LLMMonthlySpendLimitMicros int64
	// ReplanEnabled lets the Allocation function replan one Home on request
	// (REPLAN_ENABLED). Off by default; only staging switches it on.
	ReplanEnabled bool
	// ReplanAllocateFunction is the name of the Allocation Lambda function the
	// API's POST /dev/replan route invokes (REPLAN_ALLOCATE_FUNCTION_NAME).
	// Empty means the route does not exist; only the staging API sets it.
	ReplanAllocateFunction string
	// PhotosBucket (PHOTOS_BUCKET) is the private bucket resident photos are
	// uploaded to; PhotosBaseURL (PHOTOS_BASE_URL) is the public https URL they
	// are served from, without a trailing slash. Optional as a pair: with
	// neither set, the photo routes answer 503.
	PhotosBucket  string
	PhotosBaseURL string
	// Environment (ENVIRONMENT) names the deployment: local, staging or
	// production. It defaults to local. /admin/me reports it (ADR 0017).
	Environment string
}

// PhotosEnabled reports whether resident photos are configured.
func (c Config) PhotosEnabled() bool { return c.PhotosBucket != "" && c.PhotosBaseURL != "" }

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
	c.PhotosBucket = strings.TrimSpace(getenv("PHOTOS_BUCKET"))
	c.PhotosBaseURL = strings.TrimRight(strings.TrimSpace(getenv("PHOTOS_BASE_URL")), "/")
	if (c.PhotosBucket == "") != (c.PhotosBaseURL == "") {
		return Config{}, errors.New("PHOTOS_BUCKET and PHOTOS_BASE_URL must be set together")
	}
	if c.PhotosBaseURL != "" {
		u, err := url.Parse(c.PhotosBaseURL)
		if err != nil || u.Scheme != "https" || u.Host == "" {
			return Config{}, errors.New("PHOTOS_BASE_URL must be an https URL")
		}
	}
	if err := loadLLM(getenv, &c); err != nil {
		return Config{}, err
	}
	if v := getenv("REPLAN_ENABLED"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("REPLAN_ENABLED: %w", err)
		}
		c.ReplanEnabled = b
	}
	c.ReplanAllocateFunction = strings.TrimSpace(getenv("REPLAN_ALLOCATE_FUNCTION_NAME"))
	c.Environment = strings.TrimSpace(getenv("ENVIRONMENT"))
	switch c.Environment {
	case "":
		c.Environment = "local"
	case "local", "staging", "production":
	default:
		return Config{}, fmt.Errorf("ENVIRONMENT must be local, staging or production, got %q", c.Environment)
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
	if v := strings.TrimSpace(getenv("LLM_MONTHLY_SPEND_LIMIT_USD")); v != "" {
		m, ok := parseMicroUSD(v)
		if !ok {
			return fmt.Errorf("LLM_MONTHLY_SPEND_LIMIT_USD must be a positive decimal number of dollars with at most 6 decimals, got %q", v)
		}
		c.LLMMonthlySpendLimitMicros = m
	}
	return nil
}

// parseMicroUSD reads a positive decimal number of dollars ("10", "10.5",
// "0.000001") as micro-USD without going through floating point. ok is false
// for anything else: a sign, an exponent, more than 6 decimals, zero, junk or
// a value that overflows int64.
func parseMicroUSD(s string) (micros int64, ok bool) {
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" || len(frac) > 6 || strings.Contains(s, ".") && frac == "" {
		return 0, false
	}
	for _, part := range []string{whole, frac} {
		for _, r := range part {
			if r < '0' || r > '9' {
				return 0, false
			}
		}
	}
	dollars, err := strconv.ParseInt(whole, 10, 64)
	if err != nil || dollars > math.MaxInt64/1_000_000-1 {
		return 0, false
	}
	frac += strings.Repeat("0", 6-len(frac))
	f, err := strconv.ParseInt(frac, 10, 64)
	if err != nil {
		return 0, false
	}
	micros = dollars*1_000_000 + f
	return micros, micros > 0
}
