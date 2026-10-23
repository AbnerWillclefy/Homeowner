# Architecture

Homeowner helps the people who look after their own home share the housework fairly. Each day it proposes which open **Tasks** each **Resident** does without exceeding anyone's **Energy** (see [CONTEXT.md](../../CONTEXT.md) for the domain terms, in bold here). The full v1 spec is issue #1.

These pages describe the system **as built**. Anything the spec calls for that does not exist yet is marked planned.

## Reading order

1. [System context and containers](system-context.md): the parts and how they talk.
2. [The Go backend](backend.md): packages, the two test seams, request flow.
3. [Daily Allocation](allocation.md): from the scheduled job to a Day Plan, and the referee.
4. [Data model](data-model.md): what the migrations contain.
5. [Infrastructure and delivery](infrastructure.md): AWS, Terraform, CI/CD, cost.
6. [The React PWA](web.md): its modules, localization, UI layer and data layer (query keys and cache writes).

## Legend

| Mark | Meaning |
|---|---|
| **Built** | Exists in the code on `main`. |
| **Planned** | In the spec (issue #1) or an ADR, not in the code yet. |

In diagrams, solid boxes and lines are built; dashed boxes and lines are planned.

## Decisions

| ADR | Decision |
|---|---|
| [0001](../adr/0001-chores-come-due-in-flexible-windows.md) | Chores come due in flexible windows |
| [0002](../adr/0002-mirror-the-work-stack.md) | Go, React, Terraform on AWS serverless, under $20 a month |
| [0003](../adr/0003-only-broken-commitments-break-a-streak.md) | Only broken commitments break a Streak (amended by 0014) |
| [0004](../adr/0004-ai-allocates-behind-a-deterministic-referee.md) | AI allocates behind a deterministic referee |
| [0005](../adr/0005-ship-a-react-pwa-not-a-native-app.md) | React PWA, not a native app |
| [0006](../adr/0006-localize-with-a-small-typed-module.md) | Localize with a small typed module, not a library |
| [0007](../adr/0007-tailwind-and-radix-for-an-accessible-calm-ui.md) | Tailwind and Radix for an accessible, calm UI |
| [0008](../adr/0008-scheduled-jobs-run-as-a-second-lambda-from-the-api-image.md) | Scheduled jobs run as a second Lambda from the API image |
| [0009](../adr/0009-navigate-with-a-bottom-tab-router-and-amend-the-look.md) | Navigate with a bottom-tab router and amend the look of ADR 0007 |
| [0010](../adr/0010-organise-the-pwa-by-domain-module.md) | Organise the PWA by domain module |
| [0011](../adr/0011-split-each-domain-into-layer-folders.md) | Split each domain into the same layers, in the PWA and the backend |
| [0012](../adr/0012-serve-resident-photos-from-a-private-bucket-through-the-web-cloudfront.md) | Serve Resident photos from a private bucket through the web CloudFront under unguessable keys |
| [0014](../adr/0014-a-day-with-any-completion-keeps-the-streak.md) | A day with any Completion keeps the Streak |

## Keeping this current

A pull request that adds a module, entry point, AWS resource, data table or external service updates these pages in the same pull request, and flips "planned" to "built" where it applies.
