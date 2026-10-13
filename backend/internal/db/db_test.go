package db_test

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/db"
)

func currentVersion(t *testing.T, url string) int64 {
	t.Helper()
	ctx := context.Background()
	pool, err := db.Connect(ctx, url, 0)
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

// latestMigration is the number of the newest file in backend/migrations;
// bump it when adding a migration.
const latestMigration = 14

func TestMigrateRunsOnEmptyDatabaseThenIsANoOp(t *testing.T) {
	t.Parallel()
	url := apitest.NewEmptyDatabase(t)
	ctx := context.Background()

	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if got := currentVersion(t, url); got != latestMigration {
		t.Fatalf("version after first migrate = %d, want %d", got, latestMigration)
	}

	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	if got := currentVersion(t, url); got != latestMigration {
		t.Fatalf("version after second migrate = %d, want %d", got, latestMigration)
	}
}

func TestConnectFailsForUnreachableDatabase(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), 1_000_000_000)
	defer cancel()
	if _, err := db.Connect(ctx, "postgres://nobody:x@127.0.0.1:1/none?sslmode=disable", 0); err == nil {
		t.Fatal("expected an error")
	}
}

// A suspended Neon endpoint can refuse the first connections; Migrate must
// wait for the database instead of failing the deploy.
func TestMigrateRetriesUntilTheDatabaseAppears(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	anyURL := apitest.NewEmptyDatabase(t)
	u, err := url.Parse(anyURL)
	if err != nil {
		t.Fatal(err)
	}
	late := "late_" + strings.TrimPrefix(u.Path, "/")
	u.Path = "/" + late

	admin, err := pgx.Connect(ctx, anyURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(ctx)
	t.Cleanup(func() {
		c, err := pgx.Connect(ctx, anyURL)
		if err == nil {
			defer c.Close(ctx)
			_, _ = c.Exec(ctx, `DROP DATABASE IF EXISTS `+late+` WITH (FORCE)`)
		}
	})

	go func() {
		time.Sleep(1500 * time.Millisecond)
		_, _ = admin.Exec(ctx, `CREATE DATABASE `+late)
	}()

	if err := db.Migrate(ctx, u.String()); err != nil {
		t.Fatalf("migrate should wait for the database: %v", err)
	}
	if got := currentVersion(t, u.String()); got != latestMigration {
		t.Fatalf("version = %d, want %d", got, latestMigration)
	}
}

func TestMigrateGivesUpWhenContextEndsOnUnreachableDatabase(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := db.Migrate(ctx, "postgres://nobody:x@127.0.0.1:1/none?sslmode=disable"); err == nil {
		t.Fatal("expected an error")
	}
}
