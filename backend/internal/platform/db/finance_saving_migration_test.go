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

// 0040 allows the saving type; its Down turns saving rows into Transfers so the old CHECK holds.
func TestFinanceSavingMigrationDownMakesSavingsTransfers(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 39); err != nil {
		t.Fatalf("migrate to 39: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		WITH u AS (INSERT INTO users (cognito_sub, email, created_at, updated_at) VALUES ('s', 's@example.com', now(), now()) RETURNING id),
		i AS (INSERT INTO finance_items (user_id, pluggy_item_id, connected_at, import_complete) SELECT id, 'item', now(), true FROM u RETURNING id, user_id)
		INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency)
		SELECT user_id, id, 'a', 'checking', 'a', 'BRL' FROM i`); err != nil {
		t.Fatal(err)
	}
	insert := func(typ string) error {
		_, err := sqlDB.ExecContext(ctx, `
			INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
				merchant_key, type, type_set_by, created_at, updated_at)
			SELECT user_id, id, 'p', '2026-11-01', -1000, 'BRL', 'x', 'X', $1, 'user', now(), now() FROM finance_sources`, typ)
		return err
	}
	if err := insert("saving"); err == nil {
		t.Fatal("saving accepted before 0040")
	}
	if _, err := provider.UpTo(ctx, 40); err != nil {
		t.Fatalf("migrate to 40: %v", err)
	}
	if err := insert("saving"); err != nil {
		t.Fatalf("insert saving after up: %v", err)
	}
	if _, err := provider.DownTo(ctx, 39); err != nil {
		t.Fatalf("migrate down to 39: %v", err)
	}
	var typ string
	if err := sqlDB.QueryRowContext(ctx, `SELECT type FROM finance_transactions`).Scan(&typ); err != nil || typ != "transfer" {
		t.Errorf("type after down = %q, %v, want transfer", typ, err)
	}
}
