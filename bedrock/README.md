# Bedrock

Homeowner's shared design system as a package: the tokens and the React components specified in
[`docs/design/bedrock/`](../docs/design/bedrock/README.md) ([ADR 0022](../docs/adr/0022-a-shared-bedrock-design-system-amends-0007-and-0009-for-adopting-apps.md)).
It ships TypeScript source, with no build step, and is not published to npm. No app uses it yet:
`web/` and `admin/` keep their own styles until their migration epics.

## Entry points

`package.json` `exports` has three:

| Import | What it is |
|---|---|
| `@homeowner/bedrock` | Core (`src/index.ts`): the components every app can use, from `Button` to `ChartContainer`. |
| `@homeowner/bedrock/finance` | Finance (`src/finance/index.ts`): what only a money app needs, such as `Amount`, `MoneyInput`, `CategoryTag` and the charts. |
| `@homeowner/bedrock/tokens.css` | The tokens, the Tailwind theme and the type utilities (`src/tokens.css`). |

Core never imports Finance. `src/layers.test.ts` fails if any file under `src/components/` or
`src/lib/` imports a path containing `finance`.

## Workspace layout

The root `package.json` lists only `bedrock` in `workspaces`, and the root `package-lock.json`
is Bedrock's lockfile. `web/` and `admin/` keep their own lockfiles and CI, so a Bedrock
dependency bump cannot break their installs.

## Using it in an app

### Install

- **Join the workspace (recommended).** Add the app's folder to `workspaces` in the root
  `package.json`, add `"@homeowner/bedrock": "*"` to the app's dependencies, and run `npm ci` at
  the root. npm then installs one copy of React for both.
- **Stay outside.** Import the source by path and add, in the app's `vite.config.ts`,
  `resolve: { dedupe: ["react", "react-dom", "radix-ui", "vaul", "recharts"] }`. Without it,
  Bedrock's files resolve React from the root `node_modules` and the app's from its own. Two
  Reacts mean hooks throw "Invalid hook call".

`react`, `react-dom`, `radix-ui`, `vaul` and `recharts` are peer dependencies: the app provides them.

### The CSS

In the app's main stylesheet:

```css
@import "tailwindcss";
@import "@homeowner/bedrock/tokens.css";
@source "<relative path>/bedrock/src";
```

Tailwind does not scan `node_modules` or folders outside the app, so without `@source` the
classes Bedrock's components use are never generated. `showcase/showcase.css` is a working
example (it imports `../src/tokens.css`, the same file, by path).

The viewport meta needs `viewport-fit=cover`, or `env(safe-area-inset-bottom)` is 0 and the
BottomBar and Toast sit under the phone's home indicator:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### Theme ownership

Bedrock puts dark on `:root` (and `[data-theme="dark"]`) and light under `[data-theme="light"]`.
The app sets `data-theme` on `<html>`; Bedrock has no `prefers-color-scheme` query. The
recommended default is the operating system's theme, and dark when there is no preference.

`web/` does the reverse today: light by default, dark under `[data-theme="dark"]`, the choice
stored in `localStorage` as `homeowner.theme` and applied by the inline script in
`web/index.html`. An app that migrates flips that in the same pull request, or Residents who
chose Dark get light.

### Token-name collision

Bedrock's `@theme inline` and `web/src/tokens.css` both define Tailwind names such as
`--color-surface` and `--color-text`, and whichever loads last wins. Never load both: swap the
whole set in one pull request.

### Bundle weight

Recharts is the heaviest dependency. It reaches an app's production bundle only if the app
imports a chart (`ChartContainer`, `PaceChart`, `DonutChart`, `BarChart`): the exports are named
and `"sideEffects": ["*.css"]` lets the bundler drop the rest. In dev, Vite loads the whole
barrel anyway.

### vaul

The phone form of `Sheet` uses `vaul`, whose repository says it is unmaintained. It is pinned to
`~1.1.2`. If it breaks, the fallback is a Radix `Dialog` with a bottom side.

## Commands

From the repository root:

```sh
npm ci                                  # installs the workspace
npm run dev -w @homeowner/bedrock       # the showcase, http://localhost:5175 (strict port)
npm test -w @homeowner/bedrock          # Vitest, jsdom
npm run typecheck -w @homeowner/bedrock
npm run build:showcase -w @homeowner/bedrock   # static showcase in bedrock/dist-showcase/
```

The showcase renders one section per file in `showcase/sections/`. It has a theme and a language
switch, and `?theme=dark|light` and `?locale=pt-BR|en` pick the combination on load.

The tests cover the tokens (`src/tokens.test.ts`: the values match the spec, and every text and
control pair passes its contrast ratio in both themes), the components, the layer rule, and axe
over the whole showcase in all four theme and language combinations (`showcase/showcase.test.tsx`).

## Tokens

`docs/design/bedrock/tokens.css` is the source of truth. `src/tokens.css` copies its raw blocks
(dark, light and the `:root` primitives) and adds the Tailwind layer: `@theme inline` for colours
and spacing, `@theme static` for radius, easing and `font-sans`, breakpoints, and the type
utilities. `src/tokens.test.ts` checks that every custom property of the spec is declared, and
that the dark, light and primitive blocks have the spec's exact values (radius, ease and
`font-sans` excepted, as they moved to `@theme static`). After changing the spec, copy the blocks
again.

## CI

`bedrock-check` (`.github/workflows/bedrock-check.yml`) runs on pull requests that touch
`bedrock/`, the root `package.json` or `package-lock.json`: `npm ci`, typecheck, tests, and the
showcase build. When the only UI files a pull request changes are in Bedrock's `src/` or
`showcase/` and its description lacks screenshots, the `ui-screenshots` check takes the pt-BR
and English ones itself from the built showcase: each changed section, or the whole page when a
shared file such as `tokens.css` changed.

Changes are listed in [CHANGELOG.md](CHANGELOG.md).
