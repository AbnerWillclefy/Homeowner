# Data model

Related: [ADR 0001](../adr/0001-chores-come-due-in-flexible-windows.md), [ADR 0003](../adr/0003-only-broken-commitments-break-a-streak.md). Terms: **User**, **Home**, **Resident**, **Invite**, **Chore**, **Task**, **Completion**, **Check-in**, **Preference**, **Restriction**, **Day Plan** in [CONTEXT.md](../../CONTEXT.md).

## What is built

Migrations live in `backend/migrations/` as `NNNN_description.sql` files, applied with `goose` (`api migrate`, or on start in Docker Compose only). They are embedded into the binary.

| Migration | Contents |
|---|---|
| `0001_init.sql` | No tables. It only proves the migration pipeline works. |
| `0002_push_subscriptions.sql` | `push_subscriptions`: `id` (uuid), `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`, `updated_at`. One row per device. Timestamps come from the injected clock. |
| `0003_users.sql` | `users`: `id` (uuid), `cognito_sub` (unique, the identity), `email` (not unique: it can change in Cognito, and the API refreshes it on every request), `created_at`, `updated_at` (from the injected clock). Adds `push_subscriptions.user_id`, a nullable foreign key to `users` with `ON DELETE CASCADE`. It is nullable so the previous release, which does not set it, keeps working during a deploy (expand, then contract); rows saved before sign-in existed stay `NULL` and nobody can send to them. |
| `0004_homes_residents.sql` | `homes`: `id` (uuid), `timezone` (an IANA zone name), `allocation_time` (`time`, the local wall-clock time in that zone, no seconds; never a UTC instant, so daylight saving needs no handling), `created_at`, `updated_at` (from the injected clock). `residents`: `id` (uuid), `user_id` (`NOT NULL UNIQUE`, references `users`, `ON DELETE CASCADE`), `home_id` (references `homes`, `ON DELETE CASCADE`, indexed), `created_at`. The unique `user_id` is what enforces "a User is a Resident of at most one Home", so two simultaneous creates cannot both succeed. |

A Home is created by one transaction that inserts the `homes` row and the creator's `residents` row; if the `residents` insert hits the unique violation the transaction rolls back and no Home is left behind.

A User is created by the first authenticated request, with one `INSERT ... ON CONFLICT (cognito_sub) DO UPDATE ... RETURNING` statement, so two simultaneous first requests create one row. `users`, `push_subscriptions`, `homes` and `residents` are the tables built. Everything else below is the planned schema from issue #1.

## Planned tables

```mermaid
erDiagram
    users ||--o| residents : "is"
    homes ||--|{ residents : "has"
    homes ||--o{ invites : "issues"
    homes ||--o{ chores : "owns"
    chores ||--o| tasks : "one open at a time"
    tasks ||--|{ task_residents : "given to"
    residents ||--o{ task_residents : "receives"
    tasks ||--o{ completions : "recorded by"
    residents ||--o{ check_ins : "reports"
    users ||--o{ push_subscriptions : "devices"
    homes ||--o{ allocation_runs : "planned by"
```

| Table | Holds |
|---|---|
| `users`, `homes`, `residents` (built), `invites` | Accounts, Homes, membership (a User is a Resident of at most one Home), single-use 7-day Invites |
| `chores` | Category, Demands, base Effort, Importance, people needed, build-up flag, interval in days, allowed weekdays |
| `tasks`, `task_residents` | Open window, current Effort, status; who a Task is given to and whether they Committed |
| `completions` | The Task, the people who did it, the time (the Streak is computed from these, [ADR 0003](../adr/0003-only-broken-commitments-break-a-streak.md)) |
| `check_ins` | Resident, date, level, day-only Restrictions |
| Preferences and Restrictions | General on users, specific on residents |
| `allocation_runs` | Home, date, which allocator, fallback reason, recorded reasons |
| `push_subscriptions` | One per device, owned by the User who last registered it. Built. |
