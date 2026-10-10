package db_test

import (
	"context"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/db"
)

func currentVersion(t *testing.T, url string) int64 {
	t.Helper()
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	var v int64
	err = pool.QueryRow(ctx, `SELECT COALESCE(MAX(version_id), 0) FROM goose_db_version WHERE is_applied`).Scan(&v)
	if err != nil {
		t.Fatalf("read goose_db_version: %v", err)
	}
	return v
}

func TestMigrateRunsOnEmptyDatabaseThenIsANoOp(t *testing.T) {
	t.Parallel()
	url := apitest.NewEmptyDatabase(t)
	ctx := context.Background()

	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if got := currentVersion(t, url); got != 1 {
		t.Fatalf("version after first migrate = %d, want 1", got)
	}

	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	if got := currentVersion(t, url); got != 1 {
		t.Fatalf("version after second migrate = %d, want 1", got)
	}
}

func TestConnectFailsForUnreachableDatabase(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), 1_000_000_000)
	defer cancel()
	if _, err := db.Connect(ctx, "postgres://nobody:x@127.0.0.1:1/none?sslmode=disable"); err == nil {
		t.Fatal("expected an error")
	}
}
