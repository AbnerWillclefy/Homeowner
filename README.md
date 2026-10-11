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
`MIGRATE_DATABASE_URL`, `DB_MAX_CONNS` (5), `CORS_ALLOWED_ORIGINS` (comma-separated browser origins
allowed to call the API; empty sends no CORS headers).

## Web

The React PWA is in `web/` (Vite, TypeScript, `vite-plugin-pwa`). Node 22 (`web/.nvmrc`).

### Run locally

```sh
docker compose up -d        # the API, at localhost:8080
cd web
npm ci
npm run dev                 # http://localhost:5173 shows the API status
```

### Typecheck and build

```sh
cd web
npm run typecheck
npm run build               # typecheck, then a production build with the service worker
npm run preview             # serve the build to test the manifest and install
```

CI runs `npm ci`, `npm run typecheck` and `npm run build` on every pull request.

### Look and feel

Styling is Tailwind CSS v4 over semantic colour tokens (`bg-surface`, `text-muted`; raw
palette classes do not compile and a test fails on them). The appearance is System,
Light or Dark, chosen in the Settings section at the bottom of the home screen and
remembered on the device under `homeowner.theme`. A new screen must be checked by hand
in both themes and at the largest text size; see
[The React PWA](docs/architecture/web.md#ui-layer) and
[ADR 0007](docs/adr/0007-tailwind-and-radix-for-an-accessible-calm-ui.md).

### Configuration

`VITE_API_BASE_URL` (required) is the API's base URL. It is read at build time,
so each environment is its own build. `npm run dev` uses `web/.env.development`
(`http://localhost:8080`); override it in an untracked `web/.env.local`. See
`web/.env.example`. The value is public in the bundle: never put secrets in it.
The API must list the web origin in `CORS_ALLOWED_ORIGINS` (Compose already
allows `http://localhost:5173`).
