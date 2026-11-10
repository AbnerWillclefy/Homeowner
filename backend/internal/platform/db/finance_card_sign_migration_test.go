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

// 0038 negates only card rows, restarts every import, and its Down negates them back.
func TestFinanceCardSignMigrationFlipsOnlyCardRows(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 37); err != nil {
		t.Fatalf("migrate to 37: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		WITH u AS (INSERT INTO users (cognito_sub, email, created_at, updated_at) VALUES ('s', 's@example.com', now(), now()) RETURNING id),
		i AS (INSERT INTO finance_items (user_id, pluggy_item_id, connected_at, import_complete) SELECT id, 'item', now(), true FROM u RETURNING id, user_id),
		s AS (INSERT INTO finance_sources (user_id, item_id, pluggy_account_id, kind, name, currency, import_cursor)
			SELECT user_id, id, k, k, k, 'BRL', '2026-11-01' FROM i, (VALUES ('checking'), ('credit_card')) AS v (k) RETURNING id, user_id, kind)
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description,
			merchant_key, type, type_set_by, spending_category, category_set_by, created_at, updated_at)
		SELECT user_id, id, kind, '2026-11-01', CASE kind WHEN 'credit_card' THEN 5590 ELSE -1000 END, 'BRL', 'x', 'X',
			'expense', 'auto', 'other', 'auto', now(), now() FROM s`); err != nil {
		t.Fatal(err)
	}
	amounts := func() map[string]int64 {
		rows, err := sqlDB.QueryContext(ctx, `SELECT provider_id, amount_cents FROM finance_transactions`)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		out := map[string]int64{}
		for rows.Next() {
			var k string
			var v int64
			if err := rows.Scan(&k, &v); err != nil {
				t.Fatal(err)
			}
			out[k] = v
		}
		return out
	}

	if _, err := provider.UpTo(ctx, 38); err != nil {
		t.Fatalf("migrate to 38: %v", err)
	}
	if got := amounts(); got["credit_card"] != -5590 || got["checking"] != -1000 {
		t.Errorf("after up = %v, want card -5590 and checking -1000", got)
	}
	var restarted bool
	if err := sqlDB.QueryRowContext(ctx, `SELECT NOT bool_or(import_complete) AND bool_and(s.import_cursor IS NULL)
		FROM finance_items i JOIN finance_sources s ON s.item_id = i.id`).Scan(&restarted); err != nil || !restarted {
		t.Errorf("import restarted = %v, %v, want true", restarted, err)
	}

	if _, err := provider.DownTo(ctx, 37); err != nil {
		t.Fatalf("migrate down to 37: %v", err)
	}
	if got := amounts(); got["credit_card"] != 5590 || got["checking"] != -1000 {
		t.Errorf("after down = %v, want card 5590 and checking -1000", got)
	}
}
