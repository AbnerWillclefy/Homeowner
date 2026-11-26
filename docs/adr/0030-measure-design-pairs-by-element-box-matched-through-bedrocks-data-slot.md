# Measure design pairs by element box, matched through Bedrock's `data-slot`

Amends [ADR 0028](0028-render-design-artboards-in-ci-with-a-stand-in-for-the-canvas-runtime.md).

## Context

Pairs reviewed by eye let a 12px padding pass against an 8px artboard (#918). ADR 0028 rejected a pixel-diff threshold because fonts and sample data make exact pixels impossible to match, and so left the comparison to whoever looks at two screenshots.

## Decision

- **`ui-screenshots` measures the boxes of equivalent elements on both sides of each pair:** x, width, height and the gap above each element (not the absolute y, so a header that shifts 4px is not repeated down the page). It does this for every pair the apps already shoot: `web/` pages and their Sheet and Dialog states, and Revenue pages at each width. Revenue Sheet and Dialog states are not shot today and stay out.
- **Elements are found through a `ROLES` map in `.github/scripts/artboards.mjs`:** a role, a design CSS selector (a list, since Revenue's artboards use `br-*` classes and Homeowner's `hm-*`), the app's `[data-slot=<name>]`, and whether the element is a Bedrock component. Bedrock components put `data-slot="<role>"` on their root, and that attribute is part of their public contract: renaming it is a breaking change. Elements are matched by role and order; a different count ("3 rows in app, 5 in artboard") is itself a difference.
- **Differences over 4px are reported, never enforced.** They are listed in a collapsed table under the pair in the pull request description, capped at 20 rows (GitHub caps a description at 65,536 characters), with a count of the smaller ones; every box is saved as `auto-<app>-<screen>-<width>-measure.json` on the screenshots branch, and `design-pairs.sh` downloads it with the PNGs, keeping its same-commit check. The check passes when differences exist and fails only when the measurement itself errors.
- **The reviewer raises each difference over 4px as a finding** (`REVIEW.md`), and a difference inside a Bedrock component is fixed in Bedrock, not in the screen. The frontend engineer runs the pairs locally for every screen change and fixes them before opening the pull request.
- **An artboard copy may be edited only so that it renders as its own CSS declares** (an element that renders below its declared height, the artboard height guard of #922). The canvas gets the same fix, or the next copy brings the drift back. This replaces "the artboard files are never edited" of ADR 0028.

## Considered

- **A pixel-diff threshold:** rejected in 0028, still noisy.
- **Matching by accessible name:** the pt-BR glossary rewords the artboards.
- **Matching by CSS class:** couples the check to styling, and web's classes are Tailwind utilities.
- **Failing the check over 4px:** sample data and fonts would block merges on noise; the reviewer decides.
- **A Tailwind spacing scale with only the even steps:** an off-grid class would silently produce no CSS, and all existing classes would break at once.

## Consequences

- A role missing from the map is not measured.
- Different row counts in the sample data show up as count mismatches instead of sizes: where the fake data differs from the artboard, the mismatch is itself the finding.
- Bedrock markup carries attributes that exist only for this check.
- Some roles are not rendered through Bedrock yet: web's list, row, field, segmented-control, dialog and bottom-bar (its own `Card`/`CardRow`, `BottomNav`, `AppDialog`), and Revenue's list and field. They show as count mismatches ("0 in app, N in artboard") until those screens move to Bedrock (ADR 0022).
- Revenue rows are `ListRow`, so they match through `data-slot="list-row"`.
- A drifted screen produces many findings. That is the backlog, to be worked through screen by screen.
