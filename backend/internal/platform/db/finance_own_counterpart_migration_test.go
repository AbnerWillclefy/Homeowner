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

// 0042 adds own_counterpart (false on old rows), restarts every import, and its
// Down drops only the column.
func TestFinanceOwnCounterpartMigration(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 41); err != nil {
		t.Fatalf("migrate to 41: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		WITH u AS (INSERT INTO users (cognito_sub, email, created_at, updated_at) VALUES ('s', 's@example.com', now(), now()) RETURNING id),
		i AS (INSERT INTO finance_items (user_id, pluggy_item_id, connected_at, import_complete) SELECT id, 'item', now(), true FROM u RETURNING id, user_id),
		s AS (INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency, import_cursor)
			SELECT user_id, id, 'a', 'checking', 'c', 'BRL', '2026-11-01' FROM i RETURNING id, user_id)
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, 'p', '2026-11-01', -1000, 'BRL', 'x', 'X', 'expense', 'auto', 'other', 'auto', now(), now() FROM s`); err != nil {
		t.Fatal(err)
	}

	if _, err := provider.UpTo(ctx, 42); err != nil {
		t.Fatalf("migrate to 42: %v", err)
	}
	var ok bool
	if err := sqlDB.QueryRowContext(ctx, `SELECT NOT bool_or(i.import_complete) AND bool_and(s.import_cursor IS NULL)
		AND (SELECT count(*) = 1 AND NOT bool_or(own_counterpart) FROM finance_transactions)
		FROM finance_items i JOIN finance_sources s ON s.item_id = i.id`).Scan(&ok); err != nil || !ok {
		t.Errorf("after up: restarted and old rows false = %v, %v, want true", ok, err)
	}

	if _, err := provider.DownTo(ctx, 41); err != nil {
		t.Fatalf("migrate down to 41: %v", err)
	}
	var rows int
	var col bool
	if err := sqlDB.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM finance_transactions),
		EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_transactions' AND column_name = 'own_counterpart')`).Scan(&rows, &col); err != nil || rows != 1 || col {
		t.Errorf("after down: rows %d, column present %v, err %v; want 1 row and no column", rows, col, err)
	}
}
