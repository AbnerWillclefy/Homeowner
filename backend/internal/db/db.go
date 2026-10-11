// Package db opens the Postgres connection pool and runs migrations.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/AbnerWillclefy/Homeowner/backend/migrations"
)

const connectRetryWindow = 10 * time.Second

// migrateRetryWindow is longer than connectRetryWindow: a suspended Neon
// endpoint can take several seconds to resume before the first query works.
const migrateRetryWindow = 30 * time.Second

// Connect opens a pool and verifies it with a ping, retrying for about 10s
// (or until ctx ends) so the API does not crash-loop while Postgres boots.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	return ConnectWithMaxConns(ctx, url, 0)
}

// ConnectWithMaxConns is Connect with an explicit pool size (0 keeps the default).
func ConnectWithMaxConns(ctx context.Context, url string, maxConns int32) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		// pgx errors may echo the URL; do not leak credentials.
		return nil, fmt.Errorf("parse database url: invalid format")
	}
	if maxConns > 0 {
		cfg.MaxConns = maxConns
	}
	deadline := time.Now().Add(connectRetryWindow)
	for {
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err == nil {
			pctx, cancel := context.WithTimeout(ctx, 2*time.Second)
			err = pool.Ping(pctx)
			cancel()
			if err == nil {
				return pool, nil
			}
			pool.Close()
		}
		if ctx.Err() != nil || time.Now().After(deadline) {
			return nil, fmt.Errorf("connect to database: %w", err)
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("connect to database: %w", ctx.Err())
		case <-time.After(500 * time.Millisecond):
		}
	}
}

// Migrate applies every pending embedded migration. It is a no-op on a
// migrated database.
func Migrate(ctx context.Context, url string) error {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("parse database url: invalid format")
	}
	sqlDB := stdlib.OpenDB(*cfg.ConnConfig)
	defer sqlDB.Close()
	if err := waitForDatabase(ctx, sqlDB, migrateRetryWindow); err != nil {
		return err
	}
	return migrateDB(ctx, sqlDB)
}

// waitForDatabase pings until the database answers, the window passes or ctx
// ends. Only reachability is retried; a failing migration is not.
func waitForDatabase(ctx context.Context, sqlDB *sql.DB, window time.Duration) error {
	deadline := time.Now().Add(window)
	for {
		pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := sqlDB.PingContext(pctx)
		cancel()
		if err == nil {
			return nil
		}
		if ctx.Err() != nil || time.Now().After(deadline) {
			return fmt.Errorf("connect to database: %w", err)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("connect to database: %w", ctx.Err())
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func migrateDB(ctx context.Context, sqlDB *sql.DB) error {
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS)
	if err != nil {
		return fmt.Errorf("create migration provider: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}
