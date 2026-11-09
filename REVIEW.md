# Review rules

What the `pr-review` skill (`.claude/skills/pr-review/`) checks in this repository, on top of its own checklist.
Domain terms are in `GLOSSARY.md`, decisions in `docs/adr/`.

## Correctness

- **The allocator's referee (ADR 0004).** Every Day Plan must hold whoever proposed it: never exceed a Resident's
  Energy, never break a Restriction, give a two-person Task only when both Residents have Energy left, and respect
  weekday limits. A change that lets a proposal reach a Resident without passing the constraint checker, or that
  leaves no baseline fallback when the LLM fails, is a finding.
- **Migrations are expand-only.** A migration that drops, renames or rewrites data, or edits an old migration, is a
  finding unless the pull request description says why and sets its risk to `high` (`docs/agents/pr-risk.md`).

## Tests

- New non-trivial logic (a branch, a loop, a parser, money or security code, a new script) needs a test that
  exercises it (`AGENTS.md`). Missing one is a finding; a weak one is a suggestion.

## Docs

- A change to the system's shape (a new module, entry point, AWS resource, data table, or external service) updates
  `docs/architecture/` in the same pull request (`CLAUDE.md`). Missing it is a finding, except on a ticket whose
  parent is an epic: the epic's last ticket updates the docs.

## Interface

- UI is checked in pt-BR first (`DESIGN.md`, The Portuguese First Rule). Flag a fixed width, a truncation or an
  ellipsis that would cut the longer pt-BR text, and a user-facing string added in one locale only.

## Out of scope

- Formatting, import order and anything the CI's linters and type-checkers already catch.
- Do not flag that a Spending Category the User set is erased when sync reclassifies the row as a Transfer. Why: a
  Transfer has no category (the type/category CHECK), keeping it would leave the Transfer in spend totals, and the
  `Classify` doc comment records the trade-off (#452, #463).
