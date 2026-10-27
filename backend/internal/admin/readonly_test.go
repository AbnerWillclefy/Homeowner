package admin_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

// Postgres, not the Go code, is what stops a report from writing.
func TestReadOnlyTransactionRejectsWrites(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	err := admin.ReadOnly(context.Background(), app.DB, func(tx pgx.Tx) error {
		_, err := tx.Exec(context.Background(),
			`INSERT INTO homes (timezone, allocation_time, created_at, updated_at) VALUES ('UTC', '07:00', now(), now())`)
		return err
	})

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "25006" {
		t.Fatalf("write error = %v, want SQLSTATE 25006 (read_only_sql_transaction)", err)
	}
	if n := apitest.Count(t, app, `SELECT count(*) FROM homes`); n != 0 {
		t.Fatalf("homes = %d, want 0", n)
	}
}

func TestReadOnlyTransactionSetsAFiveSecondStatementTimeout(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	var got string
	err := admin.ReadOnly(context.Background(), app.DB, func(tx pgx.Tx) error {
		return tx.QueryRow(context.Background(), `SHOW statement_timeout`).Scan(&got)
	})

	if err != nil || got != "5s" {
		t.Fatalf("statement_timeout = %q, %v, want 5s", got, err)
	}
}
