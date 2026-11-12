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

// 0043 only adds: an existing Investment is unchanged and starts its history today.
func TestFinanceInvestmentValuesMigrationSeedsExistingInvestments(t *testing.T) {
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
	if _, err := provider.UpTo(ctx, 42); err != nil {
		t.Fatalf("migrate to 42: %v", err)
	}
	if _, err := sqlDB.ExecContext(ctx, `
		WITH u AS (INSERT INTO users (cognito_sub, email, created_at, updated_at) VALUES ('s', 's@example.com', now(), now()) RETURNING id)
		INSERT INTO finance_investments (id, user_id, name, value_cents, serves, created_at, updated_at)
		SELECT gen_random_uuid(), id, 'CDB', 123456, 'reserve', now(), now() FROM u`); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 43); err != nil {
		t.Fatalf("migrate to 43: %v", err)
	}
	var name, serves string
	var value int64
	if err := sqlDB.QueryRowContext(ctx, `SELECT name, value_cents, serves FROM finance_investments`).Scan(&name, &value, &serves); err != nil ||
		name != "CDB" || value != 123456 || serves != "reserve" {
		t.Errorf("investment = %q %d %q, %v", name, value, serves, err)
	}
	var rows, hist int64
	var today bool
	if err := sqlDB.QueryRowContext(ctx, `
		SELECT count(*), coalesce(sum(value_cents), 0), coalesce(bool_and(day = (now() AT TIME ZONE 'America/Sao_Paulo')::date), false)
		FROM finance_investment_values`).Scan(&rows, &hist, &today); err != nil {
		t.Fatal(err)
	}
	if rows != 1 || hist != 123456 || !today {
		t.Errorf("history rows=%d value=%d today=%v, want 1 row, 123456, today", rows, hist, today)
	}
}
