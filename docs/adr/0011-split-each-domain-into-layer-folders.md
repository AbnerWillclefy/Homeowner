# Split each domain into the same layers, in the PWA and the Go backend

[ADR 0010](0010-organise-the-pwa-by-domain-module.md) gave the PWA one folder per domain, but each folder was flat: `chores/` held 39 files of screens, hooks, API calls and pure rules side by side. The backend had domain packages for data and rules, but every HTTP handler for every domain sat in one `internal/server` package of 8.6k lines with its tests. To change a domain you had to know where three different kinds of code lived. This ADR keeps the domain as the first cut and makes the layers inside it the same everywhere, so a person or an agent can guess a file's path before searching for it. It amends ADR 0010.

## Decision

**PWA.** Domain modules live under `web/src/domains/<domain>/`, each split into the folders it needs:

| Folder | Holds |
|---|---|
| `components/` | every `.tsx`: screens, sections, providers |
| `hooks/` | `use*` hooks |
| `api/` | the HTTP clients: `api.ts`, any `*Api.ts`, and in `auth` the Cognito calls and `authedFetch` |
| `logic/` | pure functions, labels, failure messages, browser adapters |

A test sits next to the file it covers. `src/app/` (the composition root) uses the same four folders. `src/shared/` and the service worker (`src/sw.ts`, `src/sw/`) keep their shape.

**Go backend.** One package per domain, with **one file per layer** rather than one package per layer:

| File | Layer |
|---|---|
| `<package>.go` | doc, model types, sentinel errors |
| `handler.go` | the HTTP controller: `Handler`, `NewHandler`, one method per route |
| `dto.go` | named wire shapes |
| `store.go` | the repository, the only file that touches Postgres |
| other files | the service: the domain's rules |
| `handler_test.go` | the domain's black-box API tests |

`internal/server` is only the composition root: the route table, `requireUser` and `requireResident`, CORS and logging. Code that knows no domain moves to `internal/platform/` (`auth`, `clock`, `config`, `db`, `httpx`, `apitest`). The caller's User and Membership travel in `internal/identity`, which handlers read so that no domain imports another just to know who is calling. `checkinstore` merges into `checkin`.

## Why one file per layer, not one package per layer

Go packages are the unit of import. A package per layer (`chores/handler`, `chores/store`, ...) would make many tiny packages, stuttering names (`chorestore.New`) and import cycles between the layers of one domain. A file per layer keeps the layer visible in the file name and the import graph simple.

## Consequences

- The purity tests that guard `catalog` and `checkin` now check every file except `handler.go` and `store.go` respectively; `allocation`, `schedule` and `onboarding` stay pure as whole packages. The forbidden list is now all of `internal/platform/`.
- `users.Handler` needs to know whether a User lives in a Home, but `homes` imports `users`. It takes a one-method `Homes` interface that `homes.Store` satisfies.
- API test helpers several domains share live in `internal/platform/apitest/fixtures.go`.
- `infra/` already had this shape (one module per AWS concern, a thin `staging/` folder) and does not change.
