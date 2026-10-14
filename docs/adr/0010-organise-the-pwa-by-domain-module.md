# Organise the PWA by domain module, with a shared folder for the rest

Amended by [ADR 0011](0011-split-each-domain-into-layer-folders.md): domain folders now live under `src/domains/` and split into `components/`, `hooks/`, `api/` and `logic/`.

`web/src/` grew a mix of domain folders (`chores/`, `home/`, `invite/`) and technical ones (`api/`, `components/ui/`), so a change to one domain touched several folders, and generic pieces such as `Card` sat next to domain pieces such as the Category `Chip`. This ADR fixes where code goes. It amends [ADR 0007](0007-tailwind-and-radix-for-an-accessible-calm-ui.md), whose `components/ui/` folder is now `shared/ui/`.

## Decision

- **A domain module is a self-contained folder** named after its domain (`chores/`, `home/`, `invite/`, ...). It holds that domain's screens, hooks, pure logic and its API client, `api.ts`, next to their tests.
- **`shared/` holds code that belongs to no domain:** `shared/ui/` (generic UI primitives such as `Button`, `Card`, `AppDialog`, toasts), `shared/i18n/`, `shared/theme/` and `shared/config.ts`. Nothing in `shared/` imports from a domain module: a `Card` takes its tint as classes, so the caller maps a Category to its pastel.
- **`authedFetch` lives in `auth/request.ts`**, because it is built on the Cognito session and its refresh. Every module's `api.ts` imports it from there.
- **A UI piece that names a domain concept lives in that domain**, even when several screens use it: `PasswordField` and `PasswordRules` are in `auth/`; the Category `Chip`, `CategoryGlyph` and `categoryStyle` are in `chores/`, because a Category is part of a Chore.
- **`app/` is the composition root:** routes, the guard, the shell and the health banner. It may import any module.
- A new generic primitive goes in `shared/ui/` only when a screen needs it, as before.

## Consequences

- Domain modules import each other directly (`catalog/` uses `chores/api`). That is allowed; a cycle between two modules is a sign one concept is in the wrong folder.
- The wire types every call shares (`Failure`, `FieldCodes`) are still defined in `home/api.ts`. Moving them to a shared module is the next step.
