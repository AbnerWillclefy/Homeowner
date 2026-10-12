# Homeowner

Domain language lives in `CONTEXT.md`, decisions in `docs/adr/`.

## Run everything locally

From a fresh clone to signing in, getting a day plan and receiving reminders.

### Prerequisites

- Docker (Compose v2)
- Go 1.26 (`backend/go.mod`), for generating keys and running tests
- Node 22 (`web/.nvmrc`)
- AWS CLI with credentials for an AWS account. Sign-in is Amazon Cognito and
  there is no local emulator, so you need a real user pool. It is free (first
  50,000 monthly active users).

### 1. Get a Cognito user pool

You need the pool's **region**, its **id** (`<region>_XXXX`) and the web
**client id**.

**With access to staging** (the maintainer), reuse the staging pool:

```sh
cd infra/staging
terraform init -backend-config="bucket=homeowner-tfstate-<account id>" -backend-config="region=<region>"
terraform output -raw cognito_region
terraform output -raw cognito_client_id
terraform output -raw cognito_password_policy
aws cognito-idp list-user-pools --max-results 10   # the pool id (not a staging output)
```

If you don't have Terraform set up, `aws cognito-idp list-user-pool-clients --user-pool-id <pool id>`
gives the client id.

**Without access to staging**, create your own pool with the same settings as
`infra/modules/auth`:

```sh
POOL_ID=$(aws cognito-idp create-user-pool --pool-name homeowner-local \
  --username-attributes email --auto-verified-attributes email \
  --policies 'PasswordPolicy={MinimumLength=10,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}' \
  --account-recovery-setting 'RecoveryMechanisms=[{Name=verified_email,Priority=1}]' \
  --query UserPool.Id --output text)
aws cognito-idp create-user-pool-client --user-pool-id "$POOL_ID" \
  --client-name homeowner-local-web --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --query UserPoolClient.ClientId --output text
echo "$POOL_ID"   # the region is the part before the underscore
```

Cognito's default sender emails the confirmation code (about 50 emails a day;
check spam).

### 2. Generate Web Push keys

```sh
cd backend
go run ./cmd/api vapid   # prints VAPID_PUBLIC_KEY=... and VAPID_PRIVATE_KEY=...
```

Push is optional. Without keys, the app works, `/push/*` answers 503 and the
reminders controls say push is not configured.

### 3. Configure the API: root `.env`

`cp .env.example .env` and fill in:

```sh
COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<pool id>
COGNITO_CLIENT_ID=<client id>
VAPID_PUBLIC_KEY=<from step 2>
VAPID_PRIVATE_KEY=<from step 2>
VAPID_SUBJECT=mailto:you@example.com
```

Compose reads this file and passes the values to the API. The file is
git-ignored. Never commit the private key.

### 4. Configure the web: `web/.env.local`

`cp web/.env.example web/.env.local` and fill in:

```sh
VITE_API_BASE_URL=http://localhost:8080
VITE_COGNITO_REGION=<region>
VITE_COGNITO_CLIENT_ID=<client id>
VITE_PASSWORD_POLICY=<the pool's rules as one-line JSON; the example's default matches infra/modules/auth>
```

The app refuses to start if any of these is missing. Vite reads them only at
startup, so restart `npm run dev` after a change.

### 5. Start it

```sh
docker compose up -d --build   # Postgres and the API at localhost:8080, migrated on start
cd web
npm ci
npm run dev                    # http://localhost:5173
```

Check the API logs with `docker compose logs api`. A `sign-in disabled` or
`push disabled` warning means step 3 is incomplete. Rebuild with
`docker compose up -d --build` after backend changes.

### 6. Use it

- **Sign up** at http://localhost:5173 with a real email, enter the code, then
  sign in and go through onboarding.
- **Day plans**: "get my tasks right away" plans you on the spot. The
  Allocation job, which runs every 15 minutes in staging, plans every Home whose
  Allocation time has arrived and sends the push nudges. Nothing schedules it
  locally, so run one tick by hand:
  ```sh
  docker compose run --rm api allocate
  ```
- **Reminders** need the VAPID keys and a browser that allows notifications.
  `localhost` counts as a secure context, so push works in Chrome and Firefox
  without HTTPS. The service worker only exists in a production build, so test
  push with `npm run build && npm run preview` (http://localhost:4173). Add
  that origin to `CORS_ALLOWED_ORIGINS` in `docker-compose.yml` first.

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
