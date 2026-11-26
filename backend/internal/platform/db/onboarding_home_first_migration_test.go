package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/migrations"
)

// Home moved to the first step, so a stored install or reminders (reached under
// the old order, before any profile step) is reset; the other values keep meaning.
func TestHomeFirstMigrationResetsOnlyTheLegacyInstallAndRemindersSteps(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 56); err != nil {
		t.Fatalf("migrate to 56: %v", err)
	}

	rows := []struct {
		sub  string
		have *string
		want *string
	}{
		{"null", nil, nil},
		{"install", ptr("install"), nil},
		{"reminders", ptr("reminders"), nil},
		{"baseline", ptr("baseline"), ptr("baseline")},
		{"restrictions", ptr("restrictions"), ptr("restrictions")},
		{"preferences", ptr("preferences"), ptr("preferences")},
		{"done", ptr("done"), ptr("done")},
	}
	for _, r := range rows {
		if _, err := sqlDB.ExecContext(ctx, `
			INSERT INTO users (cognito_sub, email, onboarding_step, created_at, updated_at)
			VALUES ($1, $1 || '@example.com', $2, now(), now())`, r.sub, r.have); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatalf("migrate to latest: %v", err)
	}

	for _, r := range rows {
		var got *string
		if err := sqlDB.QueryRowContext(ctx,
			`SELECT onboarding_step FROM users WHERE cognito_sub = $1`, r.sub).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if deref(got) != deref(r.want) {
			t.Errorf("stored %s: onboarding_step = %v, want %v", r.sub, deref(got), deref(r.want))
		}
	}
}
