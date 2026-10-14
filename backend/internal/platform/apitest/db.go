package apitest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/db"
	"github.com/AbnerWillclefy/Homeowner/backend/migrations"
)

const (
	defaultAdminURL = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
	// Arbitrary key serialising template creation and cloning across the
	// test processes `go test ./...` starts.
	advisoryKey = 7_262_001
)

func adminURL() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return defaultAdminURL
}

// withDatabase returns adminURL with the database name replaced.
func withDatabase(t testing.TB, base, name string) string {
	t.Helper()
	u, err := url.Parse(base)
	if err != nil {
		t.Fatalf("apitest: parse TEST_DATABASE_URL: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}

func connectAdmin(t testing.TB) *pgx.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, adminURL())
	if err != nil {
		t.Fatalf("apitest: cannot reach Postgres (run `docker compose up -d db` or set TEST_DATABASE_URL): %v", err)
	}
	return conn
}

var (
	templateOnce sync.Once
	templateName string
	templateErr  error
)

// migrationsHash names the template after the migration files, so a template
// built from older migrations is never reused.
func migrationsHash() string {
	h := sha256.New()
	_ = fs.WalkDir(migrations.FS, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, _ := fs.ReadFile(migrations.FS, p)
		h.Write([]byte(p))
		h.Write(b)
		return nil
	})
	return hex.EncodeToString(h.Sum(nil))[:12]
}

func ensureTemplate(t testing.TB) string {
	t.Helper()
	templateOnce.Do(func() { templateName, templateErr = buildTemplate(t) })
	if templateErr != nil {
		t.Fatalf("apitest: build template database: %v", templateErr)
	}
	return templateName
}

func buildTemplate(t testing.TB) (string, error) {
	ctx := context.Background()
	admin := connectAdmin(t)
	defer admin.Close(ctx)

	if _, err := admin.Exec(ctx, `SELECT pg_advisory_lock($1)`, advisoryKey); err != nil {
		return "", err
	}
	defer admin.Exec(ctx, `SELECT pg_advisory_unlock($1)`, advisoryKey) //nolint:errcheck

	name := "homeowner_template_" + migrationsHash()
	var exists bool
	if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, name).Scan(&exists); err != nil {
		return "", err
	}
	if exists {
		return name, nil
	}

	building := name + "_building"
	if _, err := admin.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, building)); err != nil {
		return "", err
	}
	if _, err := admin.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s`, building)); err != nil {
		return "", err
	}
	// Migrate on its own connection, closed before the rename/clone.
	if err := db.Migrate(ctx, withDatabase(t, adminURL(), building)); err != nil {
		return "", err
	}
	if _, err := admin.Exec(ctx, fmt.Sprintf(`ALTER DATABASE %s RENAME TO %s`, building, name)); err != nil {
		return "", err
	}
	return name, nil
}

func randomName() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "test_" + hex.EncodeToString(b)
}

func createDatabase(t testing.TB, template string) string {
	t.Helper()
	ctx := context.Background()
	name := randomName()

	admin := connectAdmin(t)
	defer admin.Close(ctx)
	stmt := fmt.Sprintf(`CREATE DATABASE %s`, name)
	if template != "" {
		stmt += fmt.Sprintf(` TEMPLATE %s`, template)
		// Cloning needs exclusive access to the template.
		if _, err := admin.Exec(ctx, `SELECT pg_advisory_lock($1)`, advisoryKey); err != nil {
			t.Fatalf("apitest: lock: %v", err)
		}
		defer admin.Exec(ctx, `SELECT pg_advisory_unlock($1)`, advisoryKey) //nolint:errcheck
	}
	if _, err := admin.Exec(ctx, stmt); err != nil {
		t.Fatalf("apitest: create database: %v", err)
	}

	t.Cleanup(func() {
		c := connectAdmin(t)
		defer c.Close(ctx)
		if _, err := c.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, name)); err != nil {
			t.Errorf("apitest: drop database %s: %v", name, err)
		}
	})
	return withDatabase(t, adminURL(), name)
}

// NewEmptyDatabase creates an unmigrated database, dropped when the test ends,
// and returns its URL.
func NewEmptyDatabase(t testing.TB) string {
	t.Helper()
	return createDatabase(t, "")
}

// NewMigratedDatabase clones the migrated template into a fresh database,
// dropped when the test ends, and returns its URL.
func NewMigratedDatabase(t testing.TB) string {
	t.Helper()
	return createDatabase(t, ensureTemplate(t))
}
