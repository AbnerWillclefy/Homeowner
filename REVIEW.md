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
- Screenshot pairs. Skip this check when `.design-pairs/` is absent or empty. Otherwise, for each route and width,
  Read `auto-<app>-<screen>-<mobile|desktop>-app.png` (`<app>` is `revenue` or `web`) and its `-design.png` (the artboard), skipping an `-app.png`
  that has no `-design.png` (the screen has no artboard). Web pairs are one phone width, pt-BR, dark; their artboard wording is
  illustrative, so the catalogs and `docs/glossary-pt-BR.md` win (see Wording below). Every pair finding, visible or measured, uses the
  `(design)` category: the engineer cannot reject it, and a reply blocks the automatic merge (`claude-open-threads.sh`). Raise **one inline finding per visible difference**: a missing or extra control in the
  header's tools, a card, the grid columns it spans, the side panel, the order, a tone or colour, a state. Each
  difference is its own finding even when several land on one page file; this overrides the skill's "one finding per
  root cause in a file". Ignore font rendering, anti-aliasing and sub-pixel offsets.
  - Measurements: the check also measures each pair's equivalent elements (list, row, page header, search field, Sheet, Dialog and
    the rest, ADR 0030). Read `auto-<app>-<screen>-<mobile|desktop>-measure.json` (`{ app, design }`, the x, width, height and gap above of each
    element by role) or the details table under the pair in the description, which lists only the differences. Raise **one finding per
    difference over 4px** (role, property, app value, design value; a table of 20 rows is cut, the file has the rest). A count mismatch
    ("3 rows in app, 5 in artboard") is a difference. A role the app does not render through Bedrock yet is a count mismatch until the screen moves to Bedrock: raise it once, naming
    the cause, never in `bedrock/src/`. Today that is web's list, row, field, segmented-control, dialog, bottom-bar and card (its own `Card`,
    `BottomNav`, `AppDialog`), and Revenue's list and field. A difference inside a component with
    `bedrock: true` (`ROLES` in `.github/scripts/artboards.mjs`) is anchored on, and fixed in, the Bedrock component under `bedrock/src/`, not
    the screen. Do not raise the smaller ones.
  - Wording: text that differs where `docs/glossary-pt-BR.md` or the i18n catalogs own the word is intended (for
    example Lançamentos, Objetivos, Categorias de gasto and Fontes versus the artboards' Transações, Metas,
    Categorias and Contas). Do not raise it.
  - Anchor: the comment goes on the route's page file, found through `revenue/src/app/screens.tsx` (`/goals` is
    `revenue/src/domains/goals/GoalsPage.tsx`). If that file is not in the diff, use a changed line in the route's
    domain folder, else the first changed `revenue/src/` line. Name the route, the width and the image pair in the
    comment.
  - Re-review rounds: the rule applies there too. A pair difference counts as a correctness defect for the
    re-review filter, so raise it even though that round otherwise reports only correctness, security and
    missing-test defects.

## Out of scope

- Formatting, import order and anything the CI's linters and type-checkers already catch.
- Do not flag that a Spending Category the User set is erased when sync reclassifies the row as a Transfer. Why: a
  Transfer has no category (the type/category CHECK), keeping it would leave the Transfer in spend totals, and the
  `Classify` doc comment records the trade-off (#452, #463).
