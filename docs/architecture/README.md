# Architecture

Homeowner helps the people who look after their own home share the housework fairly. Each day it proposes which open **Tasks** each **Resident** does without exceeding anyone's **Energy** (see [CONTEXT.md](../../CONTEXT.md) for the domain terms, in bold here). The full v1 spec is issue #1.

These pages describe the system **as built**. Anything the spec calls for that does not exist yet is marked planned.

## Reading order

1. [System context and containers](system-context.md): the parts and how they talk.
2. [The Go backend](backend.md): packages, the two test seams, request flow.
3. [Daily Allocation](allocation.md): from the scheduled job to a Day Plan, and the referee.
4. [Data model](data-model.md): what the migrations contain.
5. [Infrastructure and delivery](infrastructure.md): AWS, Terraform, CI/CD, cost.

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
| [0003](../adr/0003-only-broken-commitments-break-a-streak.md) | Only broken commitments break a Streak |
| [0004](../adr/0004-ai-allocates-behind-a-deterministic-referee.md) | AI allocates behind a deterministic referee |
| [0005](../adr/0005-ship-a-react-pwa-not-a-native-app.md) | React PWA, not a native app |

## Keeping this current

A pull request that adds a module, entry point, AWS resource, data table or external service updates these pages in the same pull request, and flips "planned" to "built" where it applies.
