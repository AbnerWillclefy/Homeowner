# Render design artboards in CI with a stand-in for the canvas runtime

## Context

The design canvas (claude.ai) is the source of truth for Revenue's screens. Its artboards are copied unchanged into `docs/design/revenue/` (and Bedrock's into `docs/design/bedrock/`), but each one loads the canvas runtime `./support.js`, which the repo does not have and we do not control, so outside the canvas an artboard is only source to read. Screens built from that source drifted from the design (#703), and the fix was a pull request section listing each difference from the artboard, which the engineer filled in by hand and the maintainer checked by eye. Epic #860 replaces it: each pull request that changes a Revenue screen shows the screen next to its artboard, and the review compares the two.

## Decision

- **A stand-in runtime, `.github/scripts/dc-runtime.js`,** implements only the subset of the canvas runtime the artboards use, for one static render in the default state: `<x-dc>`, `<helmet>` (moved into `<head>`), `<sc-for list as>`, `<sc-if value>`, `<dc-import name …>`, `{{path}}` holes in text and attributes, and `class Component extends DCLogic` with `props`, `state`, `setState` and `renderVals()`, called once. Props are the `data-props` defaults; a `dc-import`'s attributes override the imported artboard's defaults. The same file loads in a browser as `support.js` and in Node through `require()`, so its pure parts are unit tested.
- **Expansion works on the source text, not the DOM.** The HTML parser foster-parents an `<sc-for>` out of a `<table>`, so a DOM walk would silently mis-render `Projection.dc.html`, whose rows come from an `<sc-for>` inside `<tbody>`.
- **The artboard files are never edited.** `.github/scripts/artboards.mjs` (`shootArtboard`) opens each file from a fake origin, and `page.route` answers its requests: `support.js` gets the stand-in, `ds/bedrock/*` gets `docs/design/bedrock/`, everything else comes from the artboard directory, and a path outside them gets a 404. The phone artboards are a fixed 390 x 844 frame with an inner scroller; `revenue-screenshots.mjs` adds a stylesheet after the render (`PHONE_CSS`) that lets the frame grow to the page, so the phone shot is taken at the app's 375 px width without cutting the frame.
- **It fails loudly.** The check fails, naming the file, when a hole's first segment is not in scope, when the page throws, when the render does not finish within 10 seconds, or when the rendered HTML still contains `{{`, `<sc-if` or `<sc-for`. A canvas feature the stand-in lacks therefore stops CI instead of rendering wrong.
- **Both sides show the same day and household.** `TODAY = "2026-11-11"` in `revenue-fake-api.mjs` (the desktop artboards are drawn on 11 November) feeds the fake API's answers and `context.clock.setFixedTime` at midday São Paulo time. The clock is set on the browser context, and the artboard is shot in a second page of that context, so the app and the artboard both run on that day. The fake API serves the desktop artboards' household; where a phone artboard's sample data disagrees, the desktop one wins.
- **The review reads the pairs; nothing pixel-diffs.** `ui-screenshots` writes `auto-revenue<route>-<mobile|desktop>-app.png` and its `-design.png` to `screenshots/<head branch>` and an App / Design table under `### Mobile` and `### Desktop`. `.github/scripts/design-pairs.sh`, a step of the Claude Code Review workflow, waits up to 10 minutes for that check on the head commit and downloads the pairs into `.design-pairs/`. `REVIEW.md` tells the reviewer to raise one inline finding per visible difference, in re-review rounds too, and to ignore wording the glossary owns and font rendering.
- **A difference is fixed, not listed.** It is fixed in code, or the design changes in the canvas first and is copied to `docs/design/` in a pull request before the screen's. The pull request section that listed differences is gone, from `revenue/CLAUDE.md` and the pull request template.

## Considered

- **Vendoring `support.js`:** it belongs to claude.ai, we cannot fetch it reliably or know its license, and it would change without notice.
- **Committing PNGs exported from the canvas:** a manual step after every design change; they go stale silently, and their data could never match the fake API.
- **A pixel-diff threshold:** fonts and sample data make exact equality unreachable, so a threshold is either noisy or blind.
- **Expanding the template by walking the DOM:** shorter, but wrong for any `<sc-for>` inside a table (above).
- **A separate design-review workflow:** its findings would land after `agent-review-fix.yml` had already applied the Claude Code Review round, and nobody would answer its threads. Folding the pairs into the existing review keeps one finding stream and one fix round, and its unresolved threads block `merge-by-risk` as any other finding does.

## Consequences

- A canvas feature the stand-in lacks fails `ui-screenshots` until the stand-in grows to cover it. A subtle semantic difference (how the real runtime treats `"0"` in an `sc-if`, say) would render quietly wrong; the stand-in implements only what the files use today to keep that surface small.
- The fake API's data is design data: changing it means changing the artboards in the canvas first.
- Only default props are shot, so interactive states (a Sheet open, an error view) are not compared.
- Claude Code Review now waits for `ui-screenshots` (up to 10 minutes inside its 30-minute timeout) and reads up to four images per route. A missing, failed or stale shot only skips the comparison; it never blocks the review.
- `dc-runtime.js` and `artboards.mjs` know nothing about Revenue: `shootArtboard` takes the directory and `pairsMarkdown` the images, so `web/` can reuse them with its own route map once its screens have artboards.
