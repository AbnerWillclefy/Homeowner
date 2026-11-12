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

// 0044 labels every existing push subscription Homeowner's and rejects other apps.
func TestPushSubscriptionAppMigrationDefaultsToHomeowner(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 43); err != nil {
		t.Fatalf("migrate to 43: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at, updated_at)
		VALUES ('https://push.example.com/old', 'p', 'a', now(), now())`); err != nil {
		t.Fatal(err)
	}

	if _, err := provider.UpTo(ctx, 44); err != nil {
		t.Fatalf("migrate to 44: %v", err)
	}

	var app string
	if err := sqlDB.QueryRowContext(ctx, `SELECT app FROM push_subscriptions`).Scan(&app); err != nil || app != "homeowner" {
		t.Errorf("existing row app = %q, %v, want homeowner", app, err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		INSERT INTO push_subscriptions (endpoint, p256dh, auth, app, created_at, updated_at)
		VALUES ('https://push.example.com/x', 'p', 'a', 'other', now(), now())`); err == nil {
		t.Error("app 'other' was accepted, want the check constraint to reject it")
	}
}
