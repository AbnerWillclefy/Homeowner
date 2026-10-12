package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/migrations"
)

// Users who exist before onboarding shipped must never be walked through it,
// so the migration marks them done. A User created afterwards starts unset.
func TestOnboardingMigrationBackfillsExistingUsersToDone(t *testing.T) {
	t.Parallel()
	url := apitest.NewEmptyDatabase(t)
	ctx := context.Background()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	sqlDB := stdlib.OpenDB(*cfg.ConnConfig)
	defer sqlDB.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := provider.UpTo(ctx, 10); err != nil {
		t.Fatalf("migrate to 10: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		INSERT INTO users (cognito_sub, email, created_at, updated_at)
		VALUES ('old', 'old@example.com', now(), now())`); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatalf("migrate to latest: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		INSERT INTO users (cognito_sub, email, created_at, updated_at)
		VALUES ('new', 'new@example.com', now(), now())`); err != nil {
		t.Fatal(err)
	}

	for sub, want := range map[string]*string{"old": ptr("done"), "new": nil} {
		var got *string
		if err := sqlDB.QueryRowContext(ctx,
			`SELECT onboarding_step FROM users WHERE cognito_sub = $1`, sub).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if (got == nil) != (want == nil) || (got != nil && *got != *want) {
			t.Errorf("user %q: onboarding_step = %v, want %v", sub, deref(got), deref(want))
		}
	}
}

func ptr(s string) *string { return &s }

func deref(s *string) string {
	if s == nil {
		return "NULL"
	}
	return *s
}
