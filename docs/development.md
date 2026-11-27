# Development reference

Day-to-day commands for working on the code: tests, migrations, builds and configuration.
To get the whole app running from a fresh clone, start with
[Run everything locally](../README.md#run-everything-locally) in the README.

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
allowed to call the API; empty sends no CORS headers), `ENVIRONMENT` (`local`,
`staging` or `production`; default `local`; any other value stops the API at
start; `GET /admin/me` reports it), `LLM_MONTHLY_SPEND_LIMIT_USD` (optional,
positive decimal dollars; the Anthropic Console's monthly limit, shown by
`GET /admin/ai` and never enforced; unset shows no limit), `PLUGGY_BASE_URL`
(default `https://api.pluggy.ai`; tests point it at the fake, never at Pluggy),
`VOICE_ENABLED` (default false; turns on `POST /home/voice/interpret` and `GET /home/voice`, which
answers 503 while off; needs `ANTHROPIC_API_KEY` and uses `LLM_MODEL`).

### The super admin role

Every `/admin/` route needs an ID token whose `cognito:groups` claim contains
`super-admin` ([ADR 0017](adr/0017-operate-through-a-separate-admin-app-per-environment.md)).
Terraform creates the group in each environment's pool (`infra/modules/auth`);
membership is granted by hand, once per environment, and no code names a person.

Find the pool id with `aws cognito-idp list-user-pools --max-results 10`, or
the `user_pool_id` output of `module.auth`.

```sh
# Grant, then check
aws cognito-idp admin-add-user-to-group --user-pool-id <pool id> --username <email or sub> --group-name super-admin
aws cognito-idp admin-list-groups-for-user --user-pool-id <pool id> --username <email>

# Revoke, then check
aws cognito-idp admin-remove-user-from-group --user-pool-id <pool id> --username <email or sub> --group-name super-admin
aws cognito-idp admin-list-groups-for-user --user-pool-id <pool id> --username <email>
```

A grant shows up after the person signs in again. A revoke takes effect when
their ID token next refreshes, up to 60 minutes (`id_token_validity = 60` in
`infra/modules/auth`); until then `GET <api>/admin/me` still answers 200. After
that it answers 403.

### The finance allowlist

Only Users whose verified email is on the allowlist see Finances; every
`/me/finance` route answers 403 to anyone else, and to everyone when the list is
empty. `GET /me` tells the app with `finance: true` or `false`. There is no
admin screen: the list is one SSM `StringList` per environment,
`/homeowner/<env>/finance-allowlist`, that Terraform creates with the
placeholder `none` (which allows nobody) and never overwrites. Emails match
ignoring case. Locally, set `FINANCE_ALLOWLIST` in `.env`.

Edit it (`<env>` is `staging` or `production`):

```sh
aws ssm put-parameter --name /homeowner/<env>/finance-allowlist \
  --type StringList --value 'a@x.com,b@y.com' --overwrite
aws ssm get-parameter --name /homeowner/<env>/finance-allowlist   # check it
```

The API reads the list once, at start-up, so a change applies at the next cold
start. Force new instances with any configuration change on the function:

```sh
aws lambda update-function-configuration --function-name homeowner-<env>-api \
  --description "allowlist $(date +%F)"
```

Then sign in as an allowlisted User and check that `GET /me` answers
`finance: true`.

### Replan a staging Home

To see a fresh Day Plan for one Home on staging without waiting for the next
Allocation, run the workflow by hand: GitHub, Actions, "Replan staging", Run
workflow (branch `main`), paste the Home id (a UUID) and run. It invokes the
allocation function and prints the outcome in the run summary; a bad id, an
unknown Home or a failed replan fails the run with the reason. The LLM daily cap
still applies, so a second replan of a day often gets a baseline plan.

## Web

The React PWA is in `web/` (Vite, TypeScript, `vite-plugin-pwa`). Node 22 (`web/.nvmrc`).

### Run locally

```sh
docker compose up -d        # the API, at localhost:8080
npm ci                      # at the root: web is a workspace member
npm run dev -w web          # http://localhost:5173 shows the API status
```

### Typecheck and build

```sh
npm run typecheck -w web
npm run build -w web        # typecheck, then a production build with the service worker
npm run preview -w web      # serve the build to test the manifest and install
```

CI runs `npm ci`, `npm run typecheck` and `npm run build` on every pull request.

### Design pairs

A pull request that changes `web/` gets its screens shot by the `ui-screenshots` check: each screen at 390px, in pt-BR and dark
theme, against the end-to-end fakes, next to its artboard in `docs/design/homeowner/`, as an App / Design table under `### pt-BR`.
Nobody takes web screenshots by hand any more. `web/e2e/pairs/screens.ts` maps each artboard to a path, a fake-data setup and a state
(`openers.ts` opens the Sheet or Dialog), or says why it has no screen yet. A screen at 390px that scrolls sideways fails the check
and names the widest element, unless it is in `OVERFLOW_EXEMPT` (that list only shrinks; `screens.test.ts` bounds it).
Each pair also runs axe-core on the page after its opener, so open Sheets and Dialogs are scanned: a serious or critical violation fails the
check and names the screen, the rule and the first element, unless the screen is in `AXE_EXEMPT` (it only shrinks too, and a test fails when an
exempt screen has none left). Moderate and minor violations do not fail it. Like the overflow check, axe runs only when the screenshots are retaken.

To shoot them yourself (all artboards with `PAIRS_ALL=1`, otherwise the files in `CHANGED`, one per line):

```sh
npm run build:e2e -w web
PAIRS_ALL=1 npx -w web playwright test -c playwright.pairs.config.ts
```

The PNGs land in `web/pairs-out/` (`auto-web-<artboard>-mobile-app.png` and `-design.png`, and `-measure.json` with the boxes of both sides) and one JSON per artboard in `web/pairs-results/`. Both folders are ignored by git.

Each pair is also measured: `ROLES` in `.github/scripts/artboards.mjs` pairs a design selector with the `data-slot` Bedrock sets, the x, width,
height and gap above of each element are compared by role and order, and the differences over 4px go in a collapsed table under the pair (20 rows,
the measure file has the rest). The check never fails on a difference; it fails only if the measurement itself throws. See ADR 0030.

### Spacing grid

The `ui-screenshots` check fails a pull request that adds an off-grid spacing class under `web/`, `revenue/` or `bedrock/`
(`.github/scripts/spacing-grid.mjs`). It reads only the lines the pull request adds, so existing off-grid classes do not block
unrelated work. On padding, margin, gap, space between, inset and the four sides (negatives included) it fails odd steps other than
`1` (`gap-3`, `p-5`), fractional steps (`mt-0.5`) and arbitrary px values other than 4 that are not a multiple of 8 (`px-[12px]`). Step `1`
(4px) passes everywhere, because a static check cannot tell outer spacing from spacing inside a component. A file whose diff GitHub
leaves out for size fails too, naming the file: split the change.

To fix a failure, use the even step: the `--space-*` token, since `--spacing` is `var(--space-4)` (`bedrock/src/tokens.css`). See the
8px grid rule in [`docs/design/bedrock/README.md`](design/bedrock/README.md). Run the tests with `node --test .github/scripts/spacing-grid.test.mjs`.

### README screenshots

The screenshots in `docs/screenshots/` come from the built app running against the
end-to-end fakes (sample data, a 390x844 phone in the default dark theme, both locales). After a UI change,
capture them again:

```sh
npm run build:e2e -w web
npm exec -w web -- playwright test -c playwright.readme.config.ts  # rewrites docs/screenshots/*.png
```

The capture lives in `web/e2e/readme/`, outside the e2e suite, so CI never rewrites the images.

### Look and feel

Styling is Tailwind CSS v4 over semantic colour tokens (`bg-surface`, `text-muted`; raw
palette classes do not compile and a test fails on them). The appearance is System,
Light or Dark, chosen in the Settings section at the bottom of the home screen and
remembered on the device under `homeowner.theme`. A new screen must be checked by hand
in both themes and at the largest text size; see
[The React PWA](architecture/web.md#ui-layer) and
[ADR 0007](adr/0007-tailwind-and-radix-for-an-accessible-calm-ui.md).

### Configuration

`VITE_API_BASE_URL` (required) is the API's base URL. It is read at build time,
so each environment is its own build. `npm run dev` uses `web/.env.development`
(`http://localhost:8080`); override it in an untracked `web/.env.local`. See
`web/.env.example`. The value is public in the bundle: never put secrets in it.
The API must list the web origin in `CORS_ALLOWED_ORIGINS` (Compose already
allows `http://localhost:5173`).

## Admin

The maintainer's admin app is in `admin/` (Vite, React, TypeScript; Node 22 from
`admin/.nvmrc`). It is desktop-first and English only, with no service worker,
manifest or push. It imports nothing from `web/`. Its design tokens are
`admin/src/tokens.css`, a copy of `web/src/tokens.css`.

### Run locally

You need a user in the `super-admin` group of the pool your root `.env` points to
(see [The super admin role](#the-super-admin-role)), then:

```sh
docker compose up -d        # the API, at localhost:8080
cd admin
cp .env.example .env.local  # then fill in VITE_COGNITO_REGION and VITE_COGNITO_CLIENT_ID
npm ci
npm run dev                 # http://localhost:5174 (strict port)
```

Sign in with the same account you use in the PWA. A user outside the group sees
"This account is not allowed here" after signing in (the API answered 403).

### Test, typecheck and build

```sh
cd admin
npm run typecheck
npm test                    # vitest, jsdom
npm run build               # typecheck, then a production build
```

CI (`admin-typecheck.yml`) runs `npm ci`, typecheck, tests and build when a pull
request changes `admin/` (or anything under `.github/workflows/` or `.github/scripts/`), and is skipped otherwise.

### Configuration

All values are read at build time and validated on load, so a bad build fails
loudly. Each environment is its own build, and its own origin, so a session
(kept in `localStorage` under `admin.session`) never carries over to another.

| Variable | Meaning |
|---|---|
| `VITE_ENVIRONMENT` | `local`, `staging` or `production`. Shown as the badge. It must match the API's `ENVIRONMENT`; the app shows an error banner if `GET /admin/me` says otherwise. |
| `VITE_API_URL` | Base URL of the API. The PWA's equivalent is named `VITE_API_BASE_URL`; the two differ on purpose, so do not copy one file over the other. |
| `VITE_COGNITO_REGION`, `VITE_COGNITO_CLIENT_ID` | The same pool and app client as the PWA. |
| `VITE_ADMIN_URLS` | JSON object from environment name to that environment's admin origin, for the "Switch to ..." link, which keeps the path and query. Empty or partial is valid: a missing entry shows "<Environment> URL not configured". |

`npm run dev` reads `admin/.env.development` (`local`, `http://localhost:8080`,
`{"local":"http://localhost:5174"}`); put the Cognito values in an untracked
`admin/.env.local`. See `admin/.env.example`. The API must list
`http://localhost:5174` in `CORS_ALLOWED_ORIGINS` (Compose already does).

## Revenue

The app that holds Finances is in `revenue/` (Vite, React, TypeScript; Node 22
from `revenue/.nvmrc`), built on Bedrock ([ADR 0023](adr/0023-move-finances-into-a-second-installable-app-named-revenue.md)).
It is a member of the root npm workspace, so run its commands from the
repository root. It has the same sign-in as the PWA (sign-in and forgot password,
no sign-up), then asks `GET /me/finance`: a User on the finance allowlist reaches
the app, anyone else sees "Sem acesso" / "No access".

```sh
docker compose up -d                          # the API, at localhost:8080
cp revenue/.env.example revenue/.env.local    # fill in the Cognito values and VITE_PASSWORD_POLICY
npm ci
npm run dev -w @homeowner/revenue             # http://localhost:5175 (strict port)
npm run typecheck -w @homeowner/revenue
npm test -w @homeowner/revenue                # vitest, jsdom, axe
npm run build -w @homeowner/revenue           # typecheck, then a production build
```

For the gate to open locally, set `FINANCE_ALLOWLIST` (your email) and
`FINANCE_ENCRYPTION_KEY` in the root `.env`; Compose passes both to the API and
allows `http://localhost:5175` in `CORS_ALLOWED_ORIGINS`. CI (`revenue-check.yml`)
runs `npm ci`, typecheck, tests and build when a pull request changes `revenue/`,
`bedrock/`, the root package files, or anything under `.github/workflows/` or
`.github/scripts/`, and is skipped otherwise.

### Configuration

Read at build time and validated on load. The session lives in `localStorage`
under `revenue.session`, the language under `revenue.locale`, the theme under
`revenue.theme` and the hide-values choice under `revenue.hideValues`, none of them shared with Homeowner.

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Base URL of the API. |
| `VITE_COGNITO_REGION`, `VITE_COGNITO_CLIENT_ID` | The same pool and app client as the PWA. |
| `VITE_PASSWORD_POLICY` | The JSON of Terraform's `cognito_password_policy` output, the same value as the PWA's. The new-password step of "Esqueci a senha" lists the rules from it. |

`npm run dev` reads `revenue/.env.development` (the local API); put the rest in an
untracked `revenue/.env.local`. See `revenue/.env.example`.

## Bedrock

The shared design system package is in `bedrock/`, a member of the root npm
workspace with Revenue (Node 22 from `bedrock/.nvmrc`). Run its commands from the repository root:

```sh
npm ci
npm run dev -w @homeowner/bedrock             # the showcase, http://localhost:5175 (strict port)
npm test -w @homeowner/bedrock
npm run typecheck -w @homeowner/bedrock
npm run build:showcase -w @homeowner/bedrock
```

How an app adopts it, and what `bedrock-check` runs, is in
[`bedrock/README.md`](../bedrock/README.md).
