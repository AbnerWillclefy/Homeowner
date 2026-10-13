# The Go backend

Related: [ADR 0004](../adr/0004-ai-allocates-behind-a-deterministic-referee.md), [ADR 0002](../adr/0002-mirror-the-work-stack.md). Terms: **Allocation**, **Day Plan** in [CONTEXT.md](../../CONTEXT.md).

The backend is one Go module in `backend/`. In Go, code under `internal/` can only be imported from inside this module, and each folder is a *package*. `cmd/<name>/` holds a program's `main` function, an *entry point*.

## Entry points

| Entry point | Status | What it does |
|---|---|---|
| `cmd/api` | Built | `api` or `api serve` runs the HTTP server; `api migrate` applies database migrations and exits; `api vapid` prints a new VAPID key pair (a one-off human step, needs no database). |
| `api allocate` | Built | Runs the Allocation job once and exits: plans every Home whose Allocation time has arrived, then sends the push nudges when VAPID keys are set (for local runs and manual catch-up). |
| `api events` | Built | The Allocation job's Lambda: serves only `POST /events` (the scheduled tick that Lambda Web Adapter forwards) and `GET /healthz`. Same image as the API, a different command; see [ADR 0008](../adr/0008-scheduled-jobs-run-as-a-second-lambda-from-the-api-image.md). |

## Packages

```mermaid
flowchart TD
    main["cmd/api main"]
    server["internal/server: routes, middleware"]
    config["internal/config: env variables"]
    db["internal/db: pgx pool, goose migrations"]
    clock["internal/clock: System and Fake"]
    push["internal/push: Sender, Store, WebPushSender, Fake"]
    auth["internal/auth: Verifier, Cognito, Fake"]
    users["internal/users: Store (find or create)"]
    homes["internal/homes: Store (Homes and Residents)"]
    invites["internal/invites: Store (create, lookup, accept)"]
    chores["internal/chores: Validate, Store"]
    catalog["internal/catalog: Entries, Propose, pure"]
    profile["internal/profile: Store (baseline, preferences, restrictions)"]
    choresettings["internal/choresettings: Resolve, Store"]
    schedule["internal/schedule: Decide, pure"]
    tasks["internal/tasks: Store (refresh, open pool)"]
    dayplan["internal/dayplan: Planner, Store, EventsHandler"]
    nudge["internal/nudge: check-in reminders, Day Plan ready"]
    checkin["internal/checkin: Level, Scale, pure"]
    checkinstore["internal/checkinstore: New, Save, LoadMany, Store"]
    vocab["internal/vocab: Category, Demand and Importance ids"]
    onboarding["internal/onboarding: Steps, Next, pure"]
    mig["migrations: embedded SQL"]
    alloc["internal/allocation: Plan and Check, pure"]
    apitest["internal/apitest: test harness"]

    main --> config
    main --> db
    main --> server
    main --> clock
    main --> push
    main --> auth
    server --> clock
    server --> push
    server --> auth
    server --> users
    server --> homes
    server --> profile
    server --> invites
    invites --> homes
    server --> chores
    server --> catalog
    catalog --> chores
    server --> choresettings
    choresettings --> chores
    choresettings --> profile
    server --> tasks
    server --> dayplan
    main --> dayplan
    dayplan --> tasks
    dayplan --> profile
    dayplan --> alloc
    apitest --> dayplan
    apitest --> nudge
    main --> nudge
    nudge --> dayplan
    nudge --> push
    nudge --> checkinstore
    tasks --> schedule
    tasks --> alloc
    schedule --> alloc
    chores --> vocab
    server --> vocab
    auth --> clock
    apitest --> push
    apitest --> auth
    db --> mig
    apitest --> server
    apitest --> db
    apitest --> clock
```

`allocation` has no outgoing arrows: it imports nothing from the project and does no I/O (`purity_test.go` enforces that). `schedule` and `tasks` import it only for its `Date` type; `dayplan` is the only package that calls `Plan` and `Check`.

| Package | Role |
|---|---|
| `server` | Builds one `http.Handler` (`server.New(Deps)`). `Deps` holds everything outside the system that tests fake: database pool, clock, logger, CORS origins, the Web Push `Sender` and the public VAPID key and the token `Verifier` (nil means auth is off). |
| `config` | Reads `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `PORT`, `MIGRATE_ON_START`, `DB_MAX_CONNS`, `CORS_ALLOWED_ORIGINS`, the optional pair `COGNITO_ISSUER` and `COGNITO_CLIENT_ID` (public identifiers, so plain environment variables; one without the other is an error, the issuer must be https, neither means auth is off), and the optional set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (one key without the other is an error; neither means push is off). `VAPID_PRIVATE_KEY` is resolved from SSM through `VAPID_PRIVATE_KEY_SSM_PARAM`, like the database URLs. |
| `push` | `Sender` interface (one `Send` per subscription, returning `ErrGone` when the push service answers 404 or 410), `WebPushSender` (real, on `webpush-go`, VAPID, 24h TTL, 10s HTTP timeout; it strips a leading `mailto:` from `VAPID_SUBJECT` because webpush-go adds one, and includes the push service's response body in non-2xx errors), `Payload` (`title`, `body`, `url` and an optional `kind`, `checkin_reminder` or `day_plan_ready`, that the service worker words for the device language; the English text is always sent too), `Store` (the `push_subscriptions` table: upsert, get, `ListByUsers` (all devices of a set of Users in one query), delete, and `Deliver`, which drops a subscription the push service rejected), and `Fake` for tests. |
| `auth` | `Verifier` interface: a raw bearer token in, `Claims{Subject, Email}` out, or an error wrapping `ErrInvalidToken`. `Cognito` is the real one: RS256 only, signature from the pool's JWKS (fetched lazily on the first authenticated request, cached in memory for an hour, one refetch at most a minute for an unknown key id, old keys kept if a refresh fails, fail closed when none are known), `iss` equal to the issuer, `aud` equal to the app client, `token_use` equal to `id`, `exp` required, `email_verified` true, subject and email present. Time comes from the injected `Clock`. `Fake` mints tokens for tests and never touches the network. |
| `users` | `Store.FindOrCreate(sub, email, now)`: the single upsert behind the first-request-creates-the-User rule. |
| `onboarding` | The ordered step ids (`install`, `reminders`, `baseline`, `restrictions`, `preferences`, `home`, then `done`), `Valid` (what a client may `PUT`), `Next` (the step after the stored one) and `Before` (the stored values a step may move forward from). Stdlib only; `purity_test.go` enforces it. `users.Store.AdvanceOnboarding` applies the monotonic rule as one conditional `UPDATE`, and `homes.Store.Create` stores `done` in its transaction. |
| `homes` | `Membership{ResidentID, Home}` is a User's place in a Home: their own `residents` row and the plain `Home`. `Store.Create(userID, timezone, allocationTime, now, inHome)` inserts the Home and the first Resident in one transaction (and runs the optional `inHome` callback on it, which `POST /home` uses to add the reviewed Chores without `homes` importing `chores`) and maps the unique violation on `residents.user_id` to `ErrAlreadyResident`; `ForUser` returns the caller's `Membership` or `ErrNoHome`; `UpdateSettings` replaces the timezone and Allocation time. `LeaveTx(tx, residentID, homeID)` is the one place a Resident leaves a Home: inside the caller's transaction it locks the Home row (`FOR UPDATE`, so two last Residents leaving at once are serialised), deletes the `residents` row (the cascade clears their specific Preferences and Restrictions) and deletes the Home if nobody is left (the cascade clears its Chores, Tasks and Invites). Accepting an Invite uses it, and `Store.Leave(residentID, homeID)` wraps it in its own transaction for `DELETE /home/residents/me`. |
| `invites` | An Invite is a single-use link, valid while `now < expires_at` (`Validity`, seven days; at the exact instant it is expired). The token is 32 random bytes, base64url, shown once; only its SHA-256 is stored, and a token that is not canonical base64url of 32 bytes is `ErrNotFound` before the database is asked. `check` (pure) is the validity rule and `newToken`/`hashToken` are pure too. `Store.Create` caps a Home at `MaxOpenPerHome` (10) unused, unexpired Invites (`ErrTooManyOpen`), serialised by a `FOR NO KEY UPDATE` lock on the Home row. `Lookup` never writes. `Accept` is one transaction: claim the Invite with `UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING home_id` (the single-use guard; on zero rows a read decides `ErrNotFound`, `ErrUsed` or `ErrExpired`), then if the User lives in the same Home `ErrAlreadyHere`, in another Home without `confirmLeave` `ErrWouldLeaveHome`, with it `homes.LeaveTx`, then insert the `residents` row (a unique violation is `homes.ErrAlreadyResident`). Any error rolls the claim back, so a failed join never burns the Invite. Imports `homes`, never the reverse. No HTTP types. |
| `profile` | `Store` for the User's profile: `Load`, `SetBaseline` (set some days, clear others, one transaction), `SetPreference` (neutral deletes the row), `AddRestriction`, `RemoveRestriction`. Writes are idempotent. `MaxBaseline` (20) is the named upper bound of a Baseline. |
| `chores` | `Validate(Input)` is pure: it trims the name, de-duplicates and sorts Demands and weekdays, and returns a stable code per invalid field, all at once (`Input` is decoded straight from the JSON body; numbers arrive as `any`, so a string or 2.5 is a field code, not a bad request; the first code recorded for a field wins). `Store` has `List`, `Create`, `Update`, `Delete`; every query that takes an id also filters on `home_id`, and a miss is `ErrNotFound`, and the handlers answer 404 for an id that fails `ValidID` without asking the Store. Imports `vocab` for Categories, Demands and Importances. `Chore` carries the JSON tags and is written to the response as is. |
| `catalog` | The fixed Catalog of common Chores and the rules that turn questionnaire answers into proposed Chores; Go code, no table, no migration. Pure (stdlib and `chores.Fields` only; `purity_test.go` enforces it). `Entries()` returns copies of the Catalog table in display order; each entry carries its own rule (how many Chores the answers call for, and an optional adjustment of Effort, interval or weekdays), so adding an entry is one place. An entry has a stable `ID` (for example `clean_bathroom`), `chores.Fields` with an English fallback name, and `PerRoom`. `Answers` is decoded like `chores.Input` (counts and weekdays as `any`); `ValidateAnswers` returns codes (`invalid`, `out_of_range`, `unknown`) keyed `rooms.bathrooms`, `collection.trash`, `habits.cooking`, all at once; a missing section means none (cooking defaults to `sometimes`). `Propose(Answers)` is deterministic and follows Catalog order: a per-room entry yields one `Proposal` per room (`Instance` 1-based, `nil` when there is one), pets add `pets` Chores, a collection stream with days adds one weekly essential Chore limited to those weekdays, and habits change the Chores (a dishwasher swaps washing the dishes for loading it, no washing machine drops the laundry Chores, cooking `daily` makes the kitchen Chore heavier and more frequent). Bounds: 0 to 10 rooms per type (kitchens 0 to 3) and `MaxProposals` 80, which a test proves the largest answers stay under. The API never renders a localised name; the PWA names a Chore from `catalogId` and `instance`. |
| `choresettings` | A Resident's Preference and Restriction on one specific Chore. `Resolve(Chore, General, Specific)` is pure and holds the rule: a specific Preference (neutral included) beats the general one for the Chore's Category, else neutral (source `specific`, `general` or `default`); Restrictions only add, so the reasons are the Chore's Demands that are in the User's general Restrictions plus the specific Restriction, listed apart. `Store` has `SetPreference`, `ClearPreference`, `AddRestriction`, `RemoveRestriction` (idempotent; the two sets prove in the same statement that the Chore is in the Resident's Home, the two deletes ask only when they removed nothing; `ErrNotFound` otherwise, the same for a missing Chore) and `Effective(homeID)`, which reads the Home's Chores, Residents, all their general profiles (`profile.LoadMany`, one `ANY($1)` query per profile table) and the specific rows in one read-only repeatable-read transaction, a fixed number of queries however many Residents there are. It has no HTTP types, so the Allocation job can reuse it; `allocation` is untouched. |
| `schedule` | `Decide(Chore, latest *Task, today)` is pure (stdlib and `allocation.Date` only; `purity_test.go` enforces it) and returns one decision: `Open` a Task with a window and Effort, `SetEffort` on the open Task, or `Nothing`. Rules (ADR 0001): a recurring Chore has windows of N consecutive days, the first starting on the day it was created in the Home's zone; `WindowStart` and `WindowEnd` are inclusive dates. With allowed weekdays, the window starts on the first allowed day on or after the scheduled start and N is rounded up to whole weeks, so a Task only opens on an allowed day. A one-off Chore gets one Task, ever (a day, or a week when weekdays are limited). A window is missed when today is past `WindowEnd` and the Task is still open; the same Task stays open and keeps its window. Missed windows are derived (`floor((today - WindowStart) / length)`), never counted, so repeated or skipped runs agree; a recurring build-up Chore's current Effort is `min(5, base + missed)`, other Chores stay at base (`buildsUp` is ignored on a one-off). After a Task is done, the next window of a recurring Chore starts N days after `closed_on` at base Effort (an assumption until a Completion ticket defines it). |
| `tasks` | `Store.Refresh(homeID, now)` brings a Home's Tasks up to date: in one transaction (`statement_timeout` 5s) it converts `now` to a date in the Home's IANA zone (an unloadable zone is an error, never UTC), locks each Chore row `FOR UPDATE`, loads its latest Task, applies `schedule.Decide` and writes. Idempotent and safe in parallel; the partial unique index on open Tasks is the final guard and the insert is `ON CONFLICT DO NOTHING`. `Store.ListOpen(homeID)` returns the open pool, never nil. The daily Allocation job (`dayplan`) calls `Refresh` before it builds `allocation.State`. |
| `checkin` | The Check-in rule, pure (stdlib only; `purity_test.go` enforces it). `Level` (`drained`, `low`, `normal`, `energized`) with `Valid`, and `Scale(base, Level)`: 0, 50%, 100%, 130% of the Baseline in whole points, rounded down (integer arithmetic), 0 for a base of 0 or an unknown level. Table-tested for every level and every base 0 to `profile.MaxBaseline`. Demand validation stays in `vocab.IsDemand`. |
| `checkinstore` | Stores Check-ins (`checkins`, `checkin_demand_restrictions`). `New(level, demands)` is the one validating, de-duplicating constructor of a `CheckIn` (`ErrInvalidLevel`, `ErrUnknownDemand`); the handler and `Save` trust it, and the SQL `ON CONFLICT DO NOTHING` stays as a safety net. `Save(tx, residentID, date, CheckIn, now)` upserts on `(resident_id, checkin_date)` and replaces the day Restrictions; `LoadMany(q, residentIDs, date)` reads each Resident's Check-in in the caller's snapshot (a Resident with none is absent); `Store.Get` is the single read for the route. Day Restrictions are never written to the lasting `user_demand_restrictions`. |
| `dayplan` | Runs Allocation and stores and reads the Day Plan. `Planner` (built with `New(db, Allocator, logger, ...Option)`; `WithNudger(n)` sets the optional `Nudger` interface (`DayPlanReady`, `CheckinReminders`) that `RunDue` calls after planning every due Home, first for the Homes planned in this tick, then the reminders, inside a recover and under one shared 30s context deadline (`WithNudgeTimeout` changes it, for tests); no option means no push, and `dayplan` never imports `push`; the `Allocator` interface is the seam where the LLM allocator plugs in, and an allocator that implements `Name()` names itself in the run record) has `DueHomes(now)`, `PlanHome(homeID, now)` and `RunDue(now)`. `DueHomes` converts `now` to each Home's IANA zone and returns the Homes whose local wall-clock time is at or past their Allocation time and that have no run for the local date ("at or past", so a late tick or a daylight-saving gap still plans once); a Home with an unknown zone is logged and skipped. `PlanHome` first returns if the day has a run, then calls `tasks.Refresh`, then in one transaction locks the Home row (`FOR NO KEY UPDATE`), looks for the run again, loads the `allocation.State` (all open Tasks, overdue ones included, joined with their Chore for Demands, people and allowed weekdays; Residents with Energy and both levels of Restriction), asks the Allocator, has `allocation.Check` referee the proposal, and writes the run and the assignments. A proposal that errors or breaks any rule is never stored as a plan: the run is recorded `rejected` with the violations, nothing is assigned, the rejection is logged, and the day is taken, so it is not retried until tomorrow. Refresh runs outside the lock so a call never holds one connection while waiting for a second from the pool (with `DB_MAX_CONNS=2`); it is idempotent, so overlapping calls only repeat it. Energy is the Resident's Baseline points for the weekday of the Home's local date, scaled by their Check-in when they made one, in one function (`energyOn`); an unset day is 0 and gives that Resident nothing, even with a Check-in. The Check-in's day-only Restrictions are added to the general Demand Restrictions. `CheckIn(homeID, residentID, CheckIn, now)` stores a Check-in and, when today's run is `planned`, plans that one Resident again in the same transaction (same Home lock as `PlanHome`; see [allocation](allocation.md)); with no run it only saves, after a `rejected` run it only saves, and a failed or refused re-plan rolls everything back and returns an error. `PlanResident(homeID, residentID, now)` is "get my tasks right away": it refreshes the Tasks, locks the Home, and plans that one Resident from the pool through the same re-plan path as a Check-in (`replanRun`); with no run for the date it creates today's run first, which makes the job skip the Home today (see [allocation](allocation.md)); after a `rejected` run it changes nothing and returns `Rejected`; a failed or refused proposal rolls back and returns an error. The Day Plan actions are `Accept`, `AcceptAll`, `Refuse`, `Take` and `Complete` (`commit.go`): each begins a transaction, locks the Home with `lockHome` (the same lock as the job, a Check-in and "right away"), loads today's run with `loadRun`, acts, and commits; every early return rolls back. Accept, AcceptAll, Refuse and Take need a `planned` run (`ErrNoPlanToday`); Complete without one is `ErrNotYours`. The Task row is locked `FOR UPDATE`, joined to its Chore on `home_id`, so a Task of another Home is `ErrTaskNotFound`. Errors are sentinels (`ErrTaskNotFound`, `ErrNoPlanToday`, `ErrNotProposed`, `ErrAlreadyCommitted`, `ErrNotInPool`, `ErrNotYours`, `ErrAlreadyDone`, `ErrTwoPersonTask`, `ErrRestricted`); `dayplan` knows no status codes. `Take` runs `allocation.Check` on a plan of only that Task and ignores the over-Energy violation. `LocalDate(zone, now)` is the one place the Home's local date is computed. The server builds its own `Planner` from `Deps.Allocator` (default `allocation.Baseline`), which must be the one the job uses. `RunDue` plans each due Home and logs, but survives, a failure for one; it returns a `Summary`. `Store.Today` reads the stored plan for the API and never plans or refreshes. `EventsHandler` is the job Lambda's HTTP surface. Logs carry the Home id, date, allocator and counts only. |
| `vocab` | The fixed, ordered Category, Demand and Importance ids (snake_case, stored and sent as-is) with `IsCategory`, `IsDemand` and `IsImportance`. `allocation` never imports it; its `Demand` and `Importance` values equal these ids. |
| `db` | Opens a `pgx` connection pool (retrying about 10s at start) and runs `goose` migrations. |
| `clock` | The only place allowed to read the time. Business code takes a `Clock`; tests use `Fake`. |
| `allocation` | The Allocation module, see [Daily Allocation](allocation.md). |
| `nudge` | The two pushes the Allocation tick owns. `nudge.New(db, push.Sender, logger)` returns a `Nudger` with `CheckinReminders(ctx, now)` and `DayPlanReady(ctx, homeIDs, now)`; neither returns an error, they log and swallow every failure. It imports `dayplan` (for `LocalDate`, to satisfy `dayplan.Nudger`, and for `dayplan.UnplannedHomes`, the one scan of zones and runs that `DueHomes` also uses, here called with the reminder window), `push` and `checkinstore`; `dayplan` does not import it. The window rule is the pure `inReminderWindow(local, alloc time.Duration)` (table-tested; the lead is `time.Hour`). A Home whose Check-ins fail to load is logged and skipped; the other Homes still get their reminders. Claims the `nudges` ledger before each send, sends through `push.Store.Deliver` (gone subscriptions are deleted), with a 5s timeout per send; the 30s deadline for both calls together is set by `dayplan`, not here. Rules and ordering: [Daily Allocation](allocation.md). |
| `apitest` | Starts the real server against a real Postgres for tests. When started `WithPush`, the Planner it builds (`App.Planner`, `App.RunAllocation`) carries a `nudge.Nudger` over the same fake sender, so a test sees the job's pushes in `App.Push.Sent()`; without `WithPush` the Planner has no Nudger and only plans. |

## Request flow

The handler is a plain `http.Handler`, so the planned Lambda adapter can wrap it without changes. Middleware wraps the router from the outside in.

```mermaid
sequenceDiagram
    participant B as Browser (PWA)
    participant C as cors
    participant R as recoverPanics
    participant L as logRequests
    participant M as Router (ServeMux)
    participant H as healthz handler
    participant D as Postgres

    B->>C: GET /healthz (Origin header)
    C->>R: allowed origin gets CORS headers
    R->>L: a panic would become a 500 JSON error
    L->>M: one JSON log line per request, time from Clock
    M->>H: route match
    H->>D: Ping (2s timeout)
    D-->>H: ok
    H-->>B: 200 status ok
```

Unknown routes return `404` with `{"error":"not found"}`.

Authentication is not in that chain: `requireUser` wraps individual routes (like `requirePush`), so `/healthz`, the VAPID key, CORS preflights and the 404 fallback stay open. It reads `Authorization: Bearer <token>` and asks the `Verifier`. A missing header, wrong scheme, malformed value or any verification failure gives the same `401 {"error":"unauthorized"}` with `WWW-Authenticate: Bearer`. With no Verifier it answers `503 {"error":"auth not configured"}` (fail closed). Otherwise it finds or creates the User, puts it in the request context under a private key type, and calls the handler. The token is never logged.

An Invite token is also a credential, and it travels in the URL path of `/invites/{token}`. `logRequests` and the panic recovery log `loggedPath(r.URL.Path)`, which replaces that segment with `{token}`, so the raw path never reaches the logs. Any new route that carries a secret in its path must be added to `loggedPath`.

`requireResident` wraps `requireUser` for routes on a Home's data. It loads the caller's Home, puts it in the context under a private key, and answers `404 {"error":"no home"}` when the User lives in none, so a new User never gets a 500 and nobody can reach another Home's data. Every Home-scoped route goes behind it.

`decodeBody` (in `http.go`) reads a JSON body with a caller-chosen size cap and an option to reject unknown fields. `cmd/api` imports `time/tzdata`, so `time.LoadLocation` works on Lambda and in distroless images.

## Routes

| Route | Behaviour |
|---|---|
| `GET /healthz` | Pings the database; `200 {"status":"ok"}` or `503`. |
| `GET /me` | Needs a token. `200 {"id","email"}` for the signed-in User, created by the first authenticated request. |
| `POST /home` | Needs a token. Body `{"timezone","allocationTime"}` (`"HH:MM"`, 24h) and an optional `"chores"`, an array of the `POST /home/chores` body (at most 100). `201 {"id","timezone","allocationTime"}`; the caller becomes the first Resident, and the Home, Resident and every Chore are stored in one transaction (`homes.Store.Create` runs a callback on it; `chores.InsertAll` writes), with `created_at` from the clock. `409 {"error":"already a resident"}` if they already live in a Home (decided by the unique constraint, so concurrent creates make one Home; the loser adds no Chores). `400 {"error":"invalid home","fields":{...}}` for the settings and the Chores together, all at once, with Chore keys indexed (`chores.2.baseEffort`) and `chores: too_many` over 100; nothing is stored. `400` for bad JSON or unknown fields, `413` over 64 KB. `PUT /home` does not take `chores`. |
| `GET /catalog` | Needs a token, no Home. `200 {"entries":[{"id","name","category","demands","baseEffort","importance","people","intervalDays","allowedWeekdays","buildsUp","perRoom"}]}` in display order. Adding an entry to an existing Home is the PWA posting its fields to `POST /home/chores`; adding the same entry twice makes two Chores. |
| `POST /catalog/proposals` | Needs a token, no Home. Body is the questionnaire: `{"rooms":{"bedrooms","bathrooms","kitchens","livingRooms","laundryAreas"},"outdoor":"none"/"balcony"/"yard"/"garden","pets":["dog","cat","fish","bird","other"],"collection":{"trash":[weekdays],"recycling":[weekdays]},"habits":{"cooking":"rarely"/"sometimes"/"daily","dishwasher":bool,"washingMachine":bool}}`; every part optional. `200 {"proposals":[{"catalogId","instance",...Chore fields}]}`; writes nothing. `400 {"error":"invalid answers","fields":{"rooms.bathrooms":"out_of_range"}}`, unknown JSON fields `400`, over 4 KB `413`. |
| `GET /home` | Needs a token and a Home. `200` with `id`, `timezone`, `allocationTime`; `404 {"error":"no home"}` otherwise. |
| `PUT /home` | Same body as `POST`, a full replace of the settings, by any Resident. `200` with the Home; `404` with no Home. |
| `DELETE /home/residents/me` | Needs a token and a Home (`404 {"error":"no home"}` otherwise). No body, no id: the caller's own Resident and Home come from the Membership, so nobody can remove another Resident. `204`. Removes the Resident and, by cascade, their specific Preferences, Restrictions and Day Plan assignments; the User's Baseline and general settings stay. If they were the last Resident the Home and everything in it (Chores, Tasks, Invites, Day Plans) is deleted, with no undo (the PWA confirms first). Idempotent under a race: a second concurrent leave by the same User also answers `204`. `500 {"error":"internal error"}` on a store error. |
| `GET /home/chores` | Needs a token and a Home. `200 {"chores":[...]}`, oldest first. A Chore is `id`, `name`, `category`, `demands`, `baseEffort` (1 to 5), `importance` (`essential`, `normal`, `nice_to_have`), `people` (1 or 2), `intervalDays` (1 to 365, or `null` for one-off), `allowedWeekdays` (0 = Sunday to 6; empty means any day), `buildsUp`. |
| `POST /home/chores` | Same body without `id`. `201` with the Chore. `400 {"error":"invalid chore","fields":{"baseEffort":"out_of_range"}}` with a code per field (`required`, `too_long`, `unknown`, `invalid`, `out_of_range`) and nothing stored; unknown JSON fields are `400`, over 8 KB is `413`. `buildsUp` is accepted on a one-off Chore and ignored by Scheduling. |
| `PUT /home/chores/{id}` | Full replace, same validation. `200`; `404` for an unknown, malformed or other Home's id. |
| `DELETE /home/chores/{id}` | `204`, hard delete; `404` as above. |
| `GET /home/chores/settings` | Needs a token and a Home. `200 {"residents":[{"id","you","chores":{"<choreId>":{"preference","source","restricted","restrictedBy","restrictedByChore"}}}]}`: every Resident of the Home (joining order; `you` marks the caller; no names yet) and, per Chore, the effective `preference` (`like`, `neutral`, `dislike`), its `source` (`specific`, `general`, `default`), `restricted`, the Demands causing it (`restrictedBy`) and whether a specific Restriction does (`restrictedByChore`). Empty maps, never `null`. |
| `PUT /home/chores/{id}/preference` | Body `{"preference": "like" or "neutral" or "dislike"}`, set on the caller's own Resident (never one named in the request). `204`; `400` for a bad value or unknown field; `404` for a malformed, unknown or other Home's Chore id, all with the same body. |
| `DELETE /home/chores/{id}/preference` | Clears it, so the general Preference applies again. `204`, idempotent; same `404`. |
| `PUT /home/chores/{id}/restriction`, `DELETE /home/chores/{id}/restriction` | No body. Add and remove the caller's specific Restriction on the Chore. `204`, idempotent; same `404`. |
| `POST /home/invites` | Needs a token and a Home (`404 no home` otherwise). No body. `201 {"token","expiresAt"}` (RFC 3339, seven days ahead); the token is shown only here, and the PWA builds the link `<origin>/#invite=<token>`. `429 {"error":"too many open invites"}` at 10 open Invites. Several Invites can be open at once; there is no list or revoke yet. Anyone holding the link can join (it is not tied to an email); single use and seven days are the limits. |
| `GET /invites/{token}` | Open: no token needed, so a signed-out person can see the link is good. `200 {"valid":true}` and nothing else (never the Home, its creator or any Resident). Never writes, so link-preview fetchers do not use the Invite up. An unknown or malformed token is `404 {"error":"not found"}`; `410 {"error":"used"}` and `410 {"error":"expired"}`. It is the only open route besides `/healthz` and the VAPID key; API Gateway's default route throttling (rate 10, burst 20, `infra/modules/http-api`) applies to it. |
| `POST /invites/{token}/accept` | Needs a token; the caller need not have a Home. Optional body `{"confirmLeave":bool}`. `200` with the Home (`id`, `timezone`, `allocationTime`, as `GET /home`). `404` and `410` as above; `409 {"error":"leaves current home"}` when the caller lives in another Home and did not confirm (nothing is consumed); `409 {"error":"already_here"}` for the caller's own Home (not consumed); `409 {"error":"already a resident"}` if they joined a Home concurrently. With `confirmLeave: true` the caller leaves their Home in the same transaction (`homes.LeaveTx`). |
| `GET /home/tasks` | Needs a token and a Home (`404` otherwise, so other Homes are never leaked). First refreshes the Home's Tasks for today in its zone (a lazy refresh, so no scheduled job is needed yet), then answers `200 {"tasks":[...]}`, an empty pool being `[]`, ordered by window start. A Task is `id`, `choreId`, `choreName`, `category` (its Chore's Category id, for example `kitchen`), `windowStart` and `windowEnd` (inclusive `YYYY-MM-DD` dates), `currentEffort`, `baseEffort`, `people`, `importance`. An overdue Task keeps its original window. `500` if the Home's timezone cannot be loaded. |
| `GET /home/day-plan` | Needs a token and a Home (`401`, `404 {"error":"no home"}`). Today's Day Plan for the caller's Home on the Home's local date. Read-only: it never plans and never refreshes the Tasks, so a plan cannot appear before the Allocation time. `200 {"date","allocationTime","planned","rejected","allocator","energy","mine","others","pool","doneToday"}`. Every Task also carries `committed` (true when the Resident it is assigned to accepted it today; always false in `pool`). `doneToday` is the caller's own Completions on the Home's date, oldest first, as `[{"id","choreId","choreName","category","currentEffort","completedAt"}]`; never `null`. `planned` is true when today's run produced a plan; `rejected` is true when the run was refused by the checker (nothing assigned today). Before the Allocation time both are false, `allocator` is `""`, `energy` is `null`, and `pool` is the open Tasks without a `reason`. `energy` is the caller's Energy the plan was made with (0 when their Baseline for the weekday is unset). `mine` is the caller's Tasks; `others` is `[{"residentId","tasks":[...]}]` for each other Resident who has Tasks (ids only, as in `GET /home/chores/settings`); `pool` is every open Task not assigned today. A Task is the `GET /home/tasks` shape (so it carries `category` in `mine`, `others[].tasks` and `pool`, before and after the run) plus `reason`: an assignment reason (`deadline_today`, `importance`, `lateness`, `fits_energy`) or a pool reason (`no_energy_left`, `restricted_for_all`, `weekday_not_allowed`, `two_person_deferred`, `invalid_effort`, or `added_after_plan` for a Task the run did not see). Arrays are never `null`. Reasons are stable ids localised in the PWA. |
| `POST /home/day-plan/me` | Needs a token and a Home (`401`, `404 {"error":"no home"}`). "Get my tasks right away": plans the caller alone from today's pool (`Planner.PlanResident`), never taking a Resident id or a body, and answers `200` with the same body as `GET /home/day-plan`. Other Residents' Tasks and the run row are unchanged. With no run yet today it creates the run, so the Allocation job skips that Home until tomorrow. A `rejected` day answers `200` with `rejected: true` and changes nothing. With Energy 0 the plan is empty and the pool keeps `no_energy_left`. Idempotent for the same State. A failed or refused proposal is `500` with nothing stored. |
| `POST /home/tasks/{id}/accept`, `/refuse`, `/take`, `/complete`, `POST /home/day-plan/accept-all` | Need a token and a Home (`401`, `404 {"error":"no home"}`), take no body and no Resident id: they act on the caller only. Success is `200` with the same body as `GET /home/day-plan`. `accept` Commits the caller's Proposed Task (a second accept is still `200`); `accept-all` Commits all of the caller's Proposed Tasks (nothing to accept is `200`); `refuse` sends a Proposed Task back to the pool with `reason: "refused"`, with no penalty, and no re-plan hands it out again until the next Allocation; `take` gives the caller a Task from the pool, Committed (assignment reason `taken`), even over their Energy but never over a Restriction; `complete` records a Completion (the caller, the clock's time, the Home's local date) for a Task the caller holds, so a Task from the pool is taken first. Errors: `404 {"error":"task not found"}` for a malformed, unknown or other-Home id (a malformed id never reaches Postgres); `409 {"error":"<code>"}` with a stable code: `no_plan_today` (no run today, or a rejected one: accept, accept-all, refuse, take), `not_proposed` (accept, refuse: not the caller's Proposed Task), `already_committed` (refuse after accept), `not_in_pool` (take: assigned to someone today), `not_yours` (complete: the caller does not hold it today), `already_done`, `two_person_task` (take, until two-person Tasks are built) and `restricted` (take: a Demand or Chore Restriction, or a weekday the Chore does not allow). Handlers are in `server/commit.go`, one `errors.Is` table maps the `dayplan` sentinels. |
| `GET /home/check-in` | Needs a token and a Home (`401`, `404 {"error":"no home"}`). The caller's Check-in on the Home's local date: `200 {"date":"YYYY-MM-DD","checkedIn":bool,"level":"low"|null,"restrictions":["bending"]}`; `restrictions` is never `null` and follows the `GET /demands` order. What the PWA asks whenever it opens. Read-only: it never plans. |
| `PUT /home/check-in` | Needs a token and a Home. Body `{"level":"drained"|"low"|"normal"|"energized","restrictions":[...]}`: `level` is required, `restrictions` optional (each a known Demand, duplicates ignored, a Demand already in the User's general Restrictions is fine). Idempotent: it replaces the level and the day Restrictions of today's Check-in. `200` with the `GET` body. `400` for an unknown or missing level, an unknown Demand, an unknown field or bad JSON (body limit 4 KiB); `404 {"error":"no home"}`; `401`. If today's plan exists the caller is planned again in the same transaction (see [allocation](allocation.md)); if that fails the answer is `500` and nothing changed, the Check-in included. |
| `GET /categories`, `GET /demands` | Need a token. `{"categories": [...]}` and `{"demands": [...]}`: the fixed ids in display order. Names are localised in the PWA. |
| `GET /me/onboarding` | Needs a token. `200 {"step": "<step to show>"}`: one of `install`, `reminders`, `baseline`, `restrictions`, `preferences`, `home`, or `done`; the step after the stored one. A User who lives in a Home (joined by Invite, or made a Home before onboarding existed) gets `done`, and it is stored. `GET /me` is unchanged. |
| `PUT /me/onboarding` | Needs a token. Body `{"step": "<id>"}` records that step as completed or skipped, and answers `200 {"step": "<step to show next>"}`. Valid ids are `install`, `reminders`, `baseline`, `restrictions`, `preferences`; `home` and `done` are not writable, because `POST /home` stores `done` in its own transaction. An unknown id is `400 {"error":"invalid step","code":"invalid_step"}`; malformed JSON or an unknown field is `400`, an oversize body `413`. Monotonic: a step at or before the stored one (or any step once `done`) changes nothing and answers `200` with the current state. One conditional `UPDATE`, not a read then a write, so two tabs cannot move progress backwards. |
| `GET /me/profile` | Needs a token. `{"baseline": {"sunday": null, "monday": 5, ...}, "preferences": {"kitchen": "like"}, "restrictions": ["heavy_lifting"]}`. Always all seven weekday keys (`null` = unset, 0 is a real value); preferences list only set Categories (neutral is absent); restrictions follow the `GET /demands` order. |
| `PUT /me/baseline` | Needs a token. Body maps weekday names (`sunday` to `saturday`) to an integer 0 to 20, or `null` to clear. Partial: days not named are untouched. `204`; `400` naming the field for an unknown weekday, a non-integer, a value out of range, an empty object or unknown JSON. |
| `PUT /me/preferences/{category}` | Needs a token. Body `{"preference": "like" or "neutral" or "dislike"}`; neutral deletes the row. `204`; `404` for an unknown Category; `400` for a bad value or unknown field. |
| `PUT /me/restrictions/{demand}`, `DELETE /me/restrictions/{demand}` | Need a token. Add and remove a Restriction, both idempotent. `204`; `404` for an unknown Demand. |
| `GET /push/vapid-public-key` | `{"key": "..."}`, the key browsers subscribe with. |
| `PUT /push/subscription` | Needs a token. Body is the browser's `PushSubscription.toJSON()` (`endpoint`, `keys.p256dh`, `keys.auth`, optional `userAgent`). Idempotent upsert on `endpoint`, owned by the caller (a device re-registered by another signed-in User moves to them); `204`. `400` for a non-https endpoint, missing or non-base64url keys or bad JSON; `413` over 8 KB. |
| `POST /push/test` | Needs a token. Body `{"endpoint","delaySeconds"?}`. Sends a small test notification to that one stored subscription only. `204`; `404` unknown, owned by another User or owned by nobody; `410` if the push service rejected it (the row is deleted); `502` on any other push error (the row is kept). |

Invalid Home settings answer `400 {"error":"invalid home","fields":{...}}` with every bad field and a stable code each: `timezone` is `required` or `unknown` (not an IANA zone; `Local` is refused because it means the server's zone), `allocationTime` is `required`, `invalid` (not strictly `HH:MM`) or `not_quarter_hour` (the Allocator job runs every 15 minutes, so only minutes 00, 15, 30, 45). Nothing is stored.
Every profile write answers `204` with no body, and every query uses the signed-in User's id, never one from the URL or body. Request bodies are capped at 4 KB and reject unknown fields (`decodeBody` in `server/http.go` takes the cap and a strict flag; push keeps its 8 KB cap and lenient decoding).

The three `/push/*` routes answer `503 {"error":"push not configured"}` when no VAPID keys are set, so local development and CI need none. The two write routes need a signed-in User; `GET /push/vapid-public-key` stays public. Push configuration is checked first, then the token. Subscriptions carry `user_id`, and a test send reaches only a subscription the caller owns.

## The two test seams

A seam is the one place tests are allowed to push on the system.

```mermaid
flowchart LR
    T1["API tests (black box)"] -->|HTTP| S["server + real Postgres"]
    T1 -.-> F["fakes: Clock, Web Push and Cognito built; LLM planned"]
    T1 -->|"RunAllocation"| P["dayplan.Planner, same database"]
    T2["Allocation tests (table-driven)"] -->|Plan, Check| A["allocation package"]
```

1. **The API.** `apitest.Start` runs the real server on a database cloned from a migrated template (`TEST_DATABASE_URL`), with a fake clock; `apitest.WithPush(key)` adds the recording fake Web Push sender, exposed as `App.Push`. `Start` always wires an `auth.Fake`; `App.SignInAs(email)` returns a client whose requests carry that fake's bearer token (the same email is the same User), and `apitest.WithoutAuth()` leaves the Verifier nil for the 503 case. `Client.JoinHome(t, homeID)` inserts a `residents` row for a signed-in User so tests can have several Residents without the Invite flow. `App.RunAllocation(t)` runs the Allocation job once at the fake clock's time over the same database, exactly as the scheduled tick does, and `App.UseAllocator(a)` swaps in a stub allocator (for example one the referee must reject). Tests assert on HTTP responses, never on internals, except the run record, which the job writes and only the database shows.
2. **Allocation.** Pure-function tests on `Plan` and `Check`.

There is no automated UI test; the web app is type-checked and built in CI.
