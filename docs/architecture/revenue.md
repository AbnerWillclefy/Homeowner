# Revenue, the finance app

Related: [ADR 0023](../adr/0023-move-finances-into-a-second-installable-app-named-revenue.md) (why Finances moves into its own app), [ADR 0022](../adr/0022-a-shared-bedrock-design-system-amends-0007-and-0009-for-adopting-apps.md) (Bedrock), [ADR 0019](../adr/0019-take-bank-data-from-pluggy-with-per-user-credentials-encrypted-by-the-app.md) (Pluggy). Design: [`docs/design/revenue/`](../design/revenue/README.md). Rules for changing it: [`revenue/CLAUDE.md`](../../revenue/CLAUDE.md). Terms: **User**, **Source**, **Bill**, **Goal**, **Investment** ([GLOSSARY.md](../../GLOSSARY.md)).

## What is built

Revenue is a second installable React app in `revenue/`, built on [Bedrock](bedrock.md). It shows a User their own money: Transactions, Bills, card bills, Spending Categories, Goals, Net worth, the Projection and the connected banks. It has eleven screens behind one frame, plus a first-run Onboarding outside it. Finances lives only here: the Homeowner PWA no longer has it ([web.md](web.md)), and the API's `/me/finance` routes are served to Revenue alone.

- **Its own origin and build.** A Vite app with its own `index.html`, manifest and service worker (`src/sw.ts`, push only; it precaches the app shell). In AWS it has its own private bucket and CloudFront distribution per environment (`module "revenue_web"` in `infra/staging` and `infra/production`, the same `infra/modules/web` as the PWA and the admin app), and the API lists its origin in `CORS_ALLOWED_ORIGINS`. It is the second member of the root npm workspace, after `bedrock`.
- **The same API and sign-in.** It calls the one Go API ([backend.md](backend.md)) with a Cognito ID token, signing in against the same user pool as the PWA with its own forms (`src/auth/`).
- **The gate.** After sign-in, `Gate` (`src/app/Gate.tsx`) calls `GET /me/finance` and mounts the app only on `200`. A `403` (not on the finance allowlist) shows "no access" with sign-out, a `401` signs out, and a `503` or network failure offers a retry. The gate only saves an outsider a screen of failing requests: the API's `403` on every `/me/finance` route is the control.
- **Its own notifications.** Settings subscribes the device with `PUT /push/subscription` and `app: "revenue"`, stored in `push_subscriptions.app` ([data model](data-model.md)), so Bill reminders reach Revenue's subscriptions, not the PWA's.

```mermaid
flowchart LR
    U([User on the finance allowlist]) --> REV["Revenue, revenue/<br/>own bucket and CloudFront"]
    REV -->|"sign in, refresh, forgot password"| COG["Cognito: the same pool and app client as the PWA"]
    REV -->|"/me/finance/*, /push/*, Bearer ID token"| API["Go API, the same one"]
    REV -->|"Pluggy Connect script, SRI-pinned"| PCDN["cdn.pluggy.ai"]
    API --> DB[("Postgres: the same database and User row")]
    JOB["Finance sync job, hourly"] --> DB
    JOB -->|"Bill reminders to app = 'revenue' devices"| PUSH["Browser push services"]
    PUSH --> SW["Revenue's service worker"]
```

## How it is built and deployed

- **A workspace member.** The root `package.json` is an npm workspace of `bedrock` and `revenue` (`@homeowner/revenue`), so `npm ci` at the root links `@homeowner/bedrock` into Revenue from source and one `package-lock.json` covers both. Commands run from the root with `-w @homeowner/revenue` (`docs/development.md`). Revenue uses Bedrock's components and tokens ([ADR 0022](../adr/0022-a-shared-bedrock-design-system-amends-0007-and-0009-for-adopting-apps.md)), not the PWA's `web/src/tokens.css`.
- **Build-time settings** (`src/config.ts`, checked at start and in the build): `VITE_API_URL`, `VITE_COGNITO_REGION`, `VITE_COGNITO_CLIENT_ID` and `VITE_PASSWORD_POLICY`. A missing or malformed one fails with its name. Locally they come from `revenue/.env.local`; in AWS from the `api` job's Terraform outputs. `npm run dev` serves on port 5175 (`strictPort`, because Compose's `CORS_ALLOWED_ORIGINS` allows only that port).
- **Deploy.** `deploy-revenue.yml`, a reusable workflow that `deploy-staging.yml` and `deploy-production.yml` call after their `api` job, builds Revenue and publishes it to `module "revenue_web"`'s bucket, invalidates the distribution and smoke tests it ([infrastructure](infrastructure.md)).
- **Checks.** `revenue-check` on pull requests touching `revenue/`, `bedrock/` or the root package files (see Tests and checks below).

## Sign-in and the gate

Revenue has no sign-up: a person makes their account in the Homeowner PWA (the same pool), and the allowlist, not the account, decides who gets in.

```mermaid
sequenceDiagram
    participant U as User
    participant R as Revenue
    participant C as Cognito (shared pool)
    participant A as API
    U->>R: email and password (SignIn)
    R->>C: InitiateAuth USER_PASSWORD_AUTH
    C-->>R: ID and refresh tokens, saved under revenue.session
    R->>A: GET /me/finance (Bearer ID token)
    alt 200
        A-->>R: status, Sources, items
        R->>R: Gate mounts the app (or Onboarding on a first run)
    else 403 not on the allowlist
        A-->>R: forbidden
        R->>U: "no access", sign out only
    else 401
        R->>R: sign out, back to SignIn
    else 503 or network
        R->>U: retry or sign out
    end
```

- **Cognito** (`src/auth/cognito.ts`) is called with `fetch` and the public `X-Amz-Target` API, no SDK, as the PWA does: `InitiateAuth` for sign-in (`USER_PASSWORD_AUTH`) and refresh (`REFRESH_TOKEN_AUTH`), and `ForgotPassword` then `ConfirmForgotPassword` for the "forgot password" screen (`src/auth/ForgotPassword.tsx`: email, then the emailed code and a new password checked against `VITE_PASSWORD_POLICY`, then done). Cognito's own messages are never shown; each failure maps to a kind the screen words.
- **The session** (`src/auth/session.ts`) is the ID token, the refresh token and the expiry in this origin's `localStorage` under `revenue.session`, so Revenue and the PWA never share a session even for the same User. `AuthProvider` clears the query cache when the session ends.
- **The API client** (`src/api/client.ts`, one Axios instance, [ADR 0013](../adr/0013-own-server-state-with-tanstack-query-over-one-axios-client.md)) adds the bearer token, refreshes it a minute before expiry, and on a `401` refreshes and retries once; a refused refresh clears the session, which shows sign-in.
- **The gate** is described above. On `200` it also sends a first-time User to Onboarding (below).

## Onboarding

`/onboarding` (`src/domains/onboarding/`) is a four-step first run in its own frame, outside the Shell and the navigation: Pluggy credentials (`PUT credentials`), connect banks (`POST connect-token`, Pluggy Connect, `POST items`), Monthly income (`PUT income`), done. Each step says why it asks and can be skipped; the same actions live on Sources and Settings. The Gate sends a User there only when they open `/`, `GET /me/finance` reports no Sources, the Monthly income read answers none, and this device has not finished it (`revenue.onboarding.done` in `localStorage`, also kept in memory when storage is refused). A failed income read shows the app instead. `shortcut:` the done flag is per device, so a User who skipped on another device sees it once here.

## Language and theme

- **Language** (`src/shared/i18n/`): two typed catalogs, `pt-BR` and `en`, with pt-BR the default. The stored choice (`revenue.locale`) wins; otherwise English only when the browser's first language is English, else pt-BR. Chosen in Settings (`src/shared/Preferences.tsx`, also on the sign-in and gate cards).
- **Theme** (`src/shared/theme/`): System, Light or Dark, stored as `revenue.theme` (System removes the key). An inline script in `index.html` sets `<html data-theme>` before first paint from the same key, the system appearance, else dark, Bedrock's default; Bedrock swaps its tokens on that attribute.

## Install and notifications

```mermaid
flowchart TB
    subgraph Browser
      IB["InstallBanner: beforeinstallprompt,<br/>or the Share steps on iOS"]
      SET["Settings, NotificationsCard:<br/>the one place that asks permission"]
      SH["Shell: useSyncOnLaunch,<br/>renews an existing subscription"]
      SW["sw.ts: precache, push, notificationclick"]
    end
    SET -->|"GET /push/vapid-public-key"| API["API"]
    SET -->|"PUT /push/subscription, app revenue<br/>DELETE /push/subscription to turn off"| API
    SH -->|"PUT /push/subscription, app revenue"| API
    API --> DB[("push_subscriptions, app = 'revenue'")]
    JOB["Finance job: Reminders.Run, hourly"] -->|"ListByUsers(..., revenue)"| DB
    JOB -->|"kind bill_due_today, bill_due_soon or bill_overdue, url /bills"| SW
    SW -->|"tap: focus or open /bills"| Browser
```

- **Manifest and service worker** (`vite.config.ts`, `vite-plugin-pwa` with `injectManifest`; `src/sw.ts`). The manifest names the app "Revenue", standalone, with its own icons in `public/`. The worker precaches the built app shell only and serves `index.html` for navigations, so deep links and an offline start work. It has no runtime caching and no fetch handler: API calls (they carry the token) and Cognito calls are never cached. `autoUpdate`, `skipWaiting` and `clients.claim()` move an open page to a new version. `tsconfig.sw.json` type-checks the worker without the DOM.
- **Install.** `InstallBanner` (`src/app/`) offers Chromium's install prompt, or on iPhone and iPad the Share-menu steps; dismissing hides it for the session (`revenue.install-dismissed` in `sessionStorage`).
- **Opting in.** The Notifications card in Settings is off until the User turns it on; only then is the permission asked (`enableReminders` in `src/domains/settings/logic/reminders.ts`). It subscribes with the API's VAPID key (a subscription made with another key is replaced) and saves it with `app: "revenue"`. On iOS in a browser tab it shows the install steps first, because Safari allows push only from the Home Screen app. Turning it off unsubscribes in the browser and calls `DELETE /push/subscription`. On every launch the Shell renews an existing subscription and never prompts or re-subscribes a device that turned notifications off. A Bill reminder reaches a User only when they have a Revenue subscription.
- **Bill reminders.** The finance job sends `bill_due_today`, `bill_due_soon` and `bill_overdue` ([backend](backend.md)) with `url` `/bills`. The worker (`src/sw/payload.ts`) words the three kinds in the device language (English when the device prefers it, else pt-BR; the in-app choice is not readable in a worker), never naming a Bill or an amount. Anything else, including an empty or broken payload, shows a generic "Revenue" notification, because iOS revokes a subscription whose pushes show nothing. A tap focuses an open window and navigates it to the same-origin `url`, or opens one.

## The frame

```mermaid
flowchart TB
    subgraph SHELL["Shell, src/app/Shell.tsx"]
      SB["Sidebar, 1024px and up<br/>brand, two groups, Settings at the foot<br/>badge on Contas a pagar, note 'Atualizado há'"]
      BB["BottomBar, below 1024px<br/>Overview, Transactions, Bills, Goals, More"]
      MORE["More: a Sheet with the other screens"]
      BB --> MORE
    end
    GATE["Gate: GET /me/finance"] --> SHELL
    SB -->|"GET /me/finance/bills?month=this month"| BADGE[(billsKey)]
    SB -->|"GET /me/finance"| SRC[("['finance','sources']")]

    SHELL --> MAIN["Main group"]
    SHELL --> PLAN["Planning group"]
    SHELL --> FOOT["Footer"]

    MAIN --> OV["/ Overview<br/>commitments, history, bills,<br/>transactions, savings, net-worth"]
    MAIN --> TX["/transactions<br/>transactions, PATCH transactions/{id}"]
    MAIN --> BI["/bills<br/>bills, bill-suggestions, bill and payment writes"]
    MAIN --> CB["/card-bills<br/>commitments, /me/finance, transactions,<br/>card-bills, PUT sources/{id}/bill-days"]
    MAIN --> CA["/categories and /categories/:category<br/>transactions, history, bills, PUT budgets/{category}"]
    PLAN --> GO["/goals<br/>savings, goals, reserve, contribution"]
    PLAN --> NW["/net-worth<br/>net-worth, savings, /me/finance"]
    PLAN --> PR["/projection<br/>commitments"]
    PLAN --> SO["/sources<br/>/me/finance, savings, commitments,<br/>connect-token, items, investments, sources/{id}/name"]
    FOOT --> SE["/settings<br/>/me/finance, commitments, income, credentials,<br/>savings, reserve, contribution, DELETE /me/finance, /push/*"]
```

Every path in the diagram is under `/me/finance` unless it starts with `/push`. `src/app/screens.tsx` is the one list of screens: `NAV_GROUPS` (Main: Overview, Transactions, Bills to pay, Card bills, Spending Categories; Planning: Goals, Net worth, Projection, Sources), `NAV_FOOTER` (Settings), `TABS` (the phone's four tabs) and `MORE` (the rest). Paths are English and stable (`/bills` is used by the deploy smoke test and the reminder payload); labels come from the i18n catalogs.

- **Shell** (`src/app/Shell.tsx`). From 1024px wide (`DESKTOP`, a copy of Bedrock's `--bp-desktop`) a sticky Bedrock `Sidebar` with `SidebarBrand`, the two groups and Settings at the foot. Contas a pagar carries a count badge: the Bills of this São Paulo month still to pay, read with `billsKey(thisMonth)`, the same query as the Bills screen, so marking one paid moves the badge at once; no badge while loading or after a failure, never "0". Above the footer, the note "Atualizado há 2 min" comes from `lastSyncedAt` of `GET /me/finance` through `timeAgo` (`src/shared/timeAgo.ts`, `Intl.RelativeTimeFormat`), or "importing" while the first import runs; a one-minute clock keeps it fresh. Below 1024px a sticky `BottomBar` with four tabs and "More", which opens a `Sheet` listing the other screens. The Shell also refreshes the device's push subscription on launch.
- **PageHeader** (`src/shared/PageHeader.tsx`). Every screen starts with it: the `<h1>` and a subtitle on the left, a `tools` slot on the right for `MonthSelect` and `HideValuesToggle`. Below 1024px it is the phone's one-line top bar.
- **The month** (`src/shared/month/`). `useMonthParam()` reads `?month=YYYY-MM`; a missing, malformed or future value is this month, counted in São Paulo (`saoPauloDay`), never on the device. Choosing this month leaves the URL bare, and other params (`?card=`) survive a change. `MonthSelect` is the header's dropdown of this month and the 11 before (an older month already in the URL is added). Screens with a month: Overview, Transactions, Bills, Card bills, Spending Categories. Goals, Net worth, Projection, Sources and Settings have none; The Projection shows two Leftovers per month, "Sobra pelo plano" (`leftoverCents`) and "Sobra no ritmo atual" (`paceLeftoverCents`, the plan being each category's usual spending, the median of the last 3 months), in the month card, the detail card and a table column, both hidden without a Monthly income. `CategoryCuts` lists each category with a Spending limit with its plan, its pace and, when the pace is over the plan, the cut (`paceCents - cents`, never negative), in plain ink; the chart still plots the Leftover by plan. Projection keeps its chosen month in local state, because `useMonthParam` refuses future months.
- **Hide values** (`src/shared/HideValues.tsx`). One toggle in the header masks money on every screen. It is a device preference in `localStorage` under `revenue.hideValues`, kept across sign-out and never sent to the API. Bedrock's `Amount`, `StatCard` and `ListRow` follow it through `useHiddenProps()`; chart axes, tooltips, `DonutChart`'s centre total and amounts inside plain strings do not, so each screen hides those itself. Input fields being edited (Settings) stay visible.
- **The grid.** A screen body is `grid gap-6 desktop:grid-cols-12` with cells `desktop:col-span-{3,4,5,6,7,8,12}`, one column below 1024px. The convention lives in `revenue/CLAUDE.md`; `docs/design/revenue/revenue.css` is not imported.
- **Side panels** are Bedrock's `Sheet`: a side panel from the tablet breakpoint, a bottom sheet on phones.

## The screens

Each screen is a domain folder under `src/domains/<name>/` with the layers of [ADR 0011](../adr/0011-split-each-domain-into-layer-folders.md): `api.ts` (Axios calls through `src/api/client.ts`), `hooks/` (TanStack Query), `logic/` (pure functions, unit-tested) and `components/`.

| Route | Domain folder | Reads | Writes | Sheets |
|---|---|---|---|---|
| `/` Overview | `overview` | `commitments?from=` (the month), `history?to=&months=2` (result and change against last month), `bills?month=`, `transactions?month=` (spending split), `savings` (Goals card), `net-worth?range=30d` (net worth and its month change) | none | The bills panel (`BillsAlert`) |
| `/transactions` | `transactions` | `transactions?month=` | `PATCH transactions/{id}` | `EditSheet` (detail), the filters sheet (`Toolbar`) |
| `/bills` Bills to pay | `bills` | `bills?month=` for the month and the next, `bill-suggestions` | `POST`/`PUT`/`DELETE bills`, `PUT`/`DELETE bills/{id}/payments/{month}`, `POST bill-suggestions/dismissals` | `BillFormSheet` |
| `/card-bills` Card bills | `card-bills` | `commitments?from=` (the month's card lines, leaving out the `manual` ones: a manual card has no Source, rows or closed bills), `/me/finance` (card Sources, limit), `transactions?month=` (the bill's rows), `card-bills?source=` (closed bills and average) | `PUT sources/{id}/bill-days` | none |
| `/categories`, `/categories/:category` | `categories` | `transactions?month=`, `history?to=&months=2` on the list, 6 on one category, `bills?month=` (fixed Bills) | `PUT budgets/{category}` | `LimitsSheet` (every limit, on the list), the one-category limit sheet (`LimitForm`) |
| `/goals` | `goals` | `savings` | Goals (`POST`, `PUT`, `DELETE`, `PUT goals/order`), `PUT reserve`, `PUT contribution` | Goal and setting forms (`SettingSheet`) |
| `/net-worth` | `net-worth` | `net-worth?range=` (`30d`, `90d`, `1y`), `savings` and `/me/finance` for the row names | none | none |
| `/projection` | `projection` | `commitments?from=` (this month and the ones after) | none | `CategoryCuts`, in the open month card on a phone and under the sum in the desktop detail card |
| `/sources` | `sources` | `/me/finance` (Sources, balances, limits, `items[]` with Ok or Reconectar), `savings` (Investments), `commitments?from=` (card totals, manual cards included), `manual-cards` (key `["finance","manual-cards"]`) | `POST connect-token` and `POST items` (Pluggy Connect), `PUT sources/{id}/name`, Investments (`POST`, `PUT`, `DELETE`, `PUT investments/{id}/serves`, `POST investments/{id}/use-bank-value`), manual cards (`POST`, `PUT`, `DELETE manual-cards/{id}`; a write also invalidates `commitments`, `savings` and `transactions`, and `sources` when the Pix recipient changed, because the API restarts the import) | Rename, Investment and manual card forms (the manual card sheet types the bill of this month and the 11 after it; an empty month repeats the one before) |
| `/settings` | `settings` | `/me/finance` (credentials saved), `commitments` (Monthly income), `savings` (reserve and contribution) | `PUT income`, `PUT`/`DELETE credentials`, `PUT reserve`, `PUT contribution`, `DELETE /me/finance`, `/push/*` | `CredentialsCard` |

Built differently from the artboards, on purpose: no notifications bell, no "Atualizar agora" (the API has no on-demand sync) and no "Reconectar" button on Sources (`POST connect-token` takes no Item id; the screen shows the badge and an explanation). The Card bills chart and average count closed bills only; Net worth offers no 7-day or "all" range and shows no card-bill change for the month (past bills are not stored). The bottom bar keeps five slots, Bills among them. Each screen's pull request lists the rest under "Differs from the design".

## Where state lives

- **Server state** is TanStack Query ([ADR 0013](../adr/0013-own-server-state-with-tanstack-query-over-one-axios-client.md)). Keys start with `"finance"`. Two are shared on purpose:
  - `billsKey(month)`, `["finance","bills",month,"rows"]` (`domains/bills/hooks/useBills.ts`): the Bills screen, the Sidebar badge, the Overview and the Spending Categories' fixed Bills read the same cache, so a payment shows everywhere at once.
  - `savingsKey`, `["finance","savings"]` (`domains/goals/hooks/useSavings.ts`): Goals, Sources (Investments), Settings (reserve and contribution), the Overview's Goals card and the Net worth row names. A write on any of them updates the others.
  - `GET /me/finance` is read under four keys, each for its own part: `["finance","me"]` (the Gate), `["finance","sources"]` (Sidebar note, Sources, Net worth names; polled every 5 seconds while importing), `["finance","status","card-sources"]` (Card bills) and `["finance","status","credentials"]` (Settings).
- **URL state**: `?month=` (shared, above), `?card=<sourceId>` on Card bills (the first card when absent) and `?range=` on Net worth (`30d` when absent).
- **Device state** in `localStorage`, never shared with Homeowner: `revenue.session`, `revenue.locale`, `revenue.theme`, `revenue.hideValues` and `revenue.onboarding.done`; and `revenue.install-dismissed` in `sessionStorage` ([development.md](../development.md)).

## Tests and checks

Vitest on jsdom with axe in `revenue/`: page tests per screen against a mocked API, unit tests of each `logic/` folder, the frame's tests (`Shell.test.tsx`, `ShellFrame.test.tsx`, `Gate.test.tsx`, `InstallBanner.test.tsx`), the sign-in tests in `src/auth/`, the Onboarding page and the worker's `sw/payload.test.ts`. The `revenue-check` workflow runs typecheck, tests and the build on pull requests touching `revenue/` or `bedrock/`. The `ui-screenshots` check screenshots a `revenue/` change in pt-BR and dark mode at phone and desktop width against `.github/scripts/revenue-fake-api.mjs`, which must serve every field a screen reads.
