# Homeowner

Domain language lives in `CONTEXT.md`, decisions in `docs/adr/`.

## Backend

The Go module is in `backend/`.

### Run locally

```sh
docker compose up
curl localhost:8080/healthz   # {"status":"ok"}
```

Compose starts Postgres 16 and the API; the API migrates on start
(`MIGRATE_ON_START=true`, set in Compose only). No `.env` is needed.

### Tests

```sh
docker compose up -d db
cd backend
go vet ./...
go test -race ./...
```

Tests use `TEST_DATABASE_URL` (default
`postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable`). They
fail loudly if Postgres is unreachable. Each API test gets its own database
cloned from a migrated template.

### Migrations

SQL files in `backend/migrations/` (goose, `NNNN_description.sql`). Run them
with one command:

```sh
DATABASE_URL=postgres://... go run ./cmd/api migrate
```

`migrate` reads `MIGRATE_DATABASE_URL` and falls back to `DATABASE_URL`. On
Neon, set `MIGRATE_DATABASE_URL` to the direct (non-pooled) URL: pooled
(PgBouncer, transaction mode) URLs can break migrations that use session
locks. Never enable `MIGRATE_ON_START` on Lambda: every cold start would race.

### Configuration

`DATABASE_URL` (required), `PORT` (8080), `MIGRATE_ON_START` (false),
`MIGRATE_DATABASE_URL`, `DB_MAX_CONNS` (5).
