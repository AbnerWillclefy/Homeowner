# Bedrock

Bedrock is the shared design system of the Homeowner apps: Revenue (finance), the Homeowner PWA and the admin. It defines tokens, components and rules. Each app has its own screens built on top of it.

Dark is the primary theme and comes first. Light is derived from it, with the same care. Apps open in the operating system's theme and use dark when there is no preference.

`tokens.json` holds every token with its usage note, `tokens.css` is the same as CSS custom properties, and `components/bundle.css` is the visual contract the reference renders were drawn with. The editable source is the Bedrock design system artifact; this folder is its English copy for the repo.

## Layers

Bedrock has two layers, so a project that is not about money can use it too:

- **Core**: every token except `cat-*`, and every component that does not handle money. Any project uses it, and changes the brand by remapping the primitives (see Colour).
- **Finance**: what only a money app needs: `Amount`, `MoneyInput`, `CategoryTag`, `StatCard`, `ListRow`, `AlertCard`, `PaceChart`, `DonutChart`, `BarChart` and the `cat-*` tokens.

Core never imports Finance. The layer of each component is in the Inventory at the end.

## Principles: the 8 golden rules

Every screen and component follows Shneiderman's 8 golden rules of interface design. Here is how each shows up in Bedrock:

| Rule | How Bedrock meets it |
|---|---|
| 1. Strive for consistency | One token per decision, one component per pattern. A category has the same colour and icon in every chart, list and filter. Amounts always go through `Amount`. Detail always opens in the `Sheet`. |
| 2. Serve all users | Desktop first, but every component has a phone form. Desktop shortcuts (`/` search, `Esc` close, arrows in the segmented control). Touch targets ≥ 48px, even where the control looks smaller. pt-BR and English. AA contrast in both themes. |
| 3. Offer informative feedback | Every action changes something visible within `duration-base`: the button turns `success`, the row gets a ✓, a `Toast` confirms. Loads over 300ms show a `Skeleton` in the final shape. |
| 4. Design dialogs to yield closure | Flows with a clear start, middle and end. The bills-to-pay row opens the sheet, the action happens, the sheet shows the result and the row behind it updates. Onboarding shows the current step and how many are left. |
| 5. Prevent errors | `MoneyInput` only accepts amounts. Limits and goals reject zero or negative. Validation on leaving the field, with the fix written out. Destructive actions only inside a `Dialog`. |
| 6. Permit easy reversal | Reversible changes (category, mark as paid, edit amount) happen at once with "Undo" in the `Toast`. That is why almost nothing asks for confirmation. |
| 7. Keep users in control | Nothing changes by itself on the screen the person is reading. Sync updates in the background and says so. An amount edited by hand wins over the bank's until the person chooses "use the bank's amount". |
| 8. Reduce short-term memory load | Summary before detail. Active filters visible as chips. Context comes with the number (`/ R$ 4.983`, "R$ 98 per day"). Labels always visible. Never rely on remembering what was on a previous screen. |

## 8px grid

- Every outer space (between components, card padding, page margins) is a multiple of 8: `space-8`, `space-16`, `space-24`, `space-32`, `space-40`, `space-48`, `space-64`.
- `space-4` is the half step, allowed only inside components: icon↔text, vertical padding of badges and tokens, gap between sidebar items.
- Control heights: `control-sm` 32, `control-md` 40, `control-lg` 48. Text line heights in multiples of 4 (16, 20, 24, 32, 40, 48).
- Every touch target is at least `control-lg` (48px). A control drawn at 32 or 40 extends its hit area to 48 without changing its look.
- Radii: `radius-sm` 4, `radius-md` 8, `radius-lg` 16, `radius-xl` 24, `radius-full`.
- Icons at 16px (12px inside a badge, 20px in the bottom bar).
- Values off the scale need a written reason in the code. Space comes from `gap` in flex and grid, never from a margin on each element.

## Colour

- **Two tiers**: primitives (`neutral-95`, `green-73`) hold the raw values, named by family and tone. The tone is the CIELAB lightness, from 0 (black) to 100 (white), as in Material's tonal palettes. Semantic tokens (`text`, `brand`) point to one primitive per theme. Components read only semantic tokens. A new brand changes the `green-*` values or remaps the semantic tokens, and no component changes. The `cat-*` tokens have no primitive: each is one value per theme, used once.
- **Structure**: the page is `bg`, content sits on `surface` (cards, sidebar), and what floats sits on `surface-raised` (sheet, popover, tooltip). Inputs and tracks use `surface-sunken`. In dark, separation comes from the colour step, with no shadow.
- **Text**: `text` for everything read, `text-muted` for labels, captions and references. Both pass 4.5:1 on every surface in both themes. There is no third, fainter level.
- **Brand**: `brand` is Homeowner green. It appears on the primary action, the active navigation item, links and the brand line in charts. In dark the green is light, so text on it is a dark `on-brand`, never white.
- **Hero**: `hero` is the only saturated block on a screen, reserved for the card that answers the screen's question ("how much can I still spend"). On it: text `on-hero` and `on-hero-muted`, chart line `hero-line`.
- **State**: `positive`, `warning` and `danger`, each with its `-soft` for badge backgrounds. State always comes with a word or icon, never colour alone. Normal spending is not red: `danger` is only for late, over-limit and error.
- **Categories**: 13 fixed colours (`cat-housing`, `cat-groceries`…), each with a `-soft`. They are the same in chart, icon, legend and filter, on every screen. All pass 4.5:1 on `surface`, so they also work as text colour. For an app that adopts Bedrock, these and the icons in `CategoryTag` replace `DESIGN.md`'s Spending Category table (`spend-*` becomes `cat-*`, Taxes and fees becomes `landmark`, Other becomes `circle-ellipsis`). The web PWA keeps `DESIGN.md` until it migrates.
- **Focus**: a 2px solid `focus` ring with a 2px offset on every focusable element. It passes 3:1 on every surface.

## Typography

- One family: **Inter**, bundled through `@fontsource`, with the system stack as fallback. Weights 400, 500 and 600. 700 only for the app name.
- Numbers are always tabular (`font-variant-numeric: tabular-nums`), so columns and changing values stay aligned.
- Scale: `page-title` 24/32 · `section-title` 18/24 · `card-label` 14/20 · `value-hero` 40/48 · `value-lg` 32/40 · `value-md` 20/24 · `value-sm` 14/20 · `body` 14/20 · `body-strong` 14/20 · `caption` 12/16 · `label` 12/16 · `overline` 11/16.
- One `page-title` per screen, one `value-hero` per screen. A card's label is `card-label` in `text-muted`, never a large title.
- Sentence case everywhere. Uppercase only in the `overline` of sidebar groups.
- Text in a field is 16px on touch screens (`pointer: coarse`): iOS Safari zooms into any field under 16px on focus.

## Amounts in reais

- Always through the `Amount` component, which takes cents and formats: `R$ 2.183,41`.
- The main amount stands out with its reference beside it in `text-muted`: `R$ 2.183,41 / R$ 4.983`. The reference is rounded; the amount is not.
- Income gets "+" and `positive`. Spending gets no sign and no red.
- Axes and tooltips abbreviate: "R$ 8k", "R$ 1,2 mi".
- The eye in the header hides every amount (`R$ ••••`) without changing the layout.

## Icons

- Lucide, 2px stroke, 16px, in the colour of the text beside it (`currentColor`).
- Each category has a fixed icon (list in `CategoryTag`). Banks show the bank's logo, from Pluggy.
- No emoji in the interface.

## Motion

- `duration-fast` 150ms (hover, colour), `duration-base` 200ms (segmented pill, success state, toast), `duration-slow` 250ms (sheet, panel, chart redraw).
- `ease-standard` for what enters or moves, `ease-exit` for what leaves.
- Motion shows cause and effect (the button turns success, the item gets a ✓, the card behind changes). It is never decoration.
- With `prefers-reduced-motion`, everything changes state without animating.

## Interaction states

Every interactive component has these states, and its guideline says how each one looks:

| State | Rule |
|---|---|
| Hover | The variant's hover token (`brand-hover`, `surface-hover`). Only with a pointer: touch has no hover. |
| Pressed | The same token as hover, so a tap gives feedback on touch. |
| Focus | The `focus` ring, 2px with a 2px offset, on `:focus-visible` only. |
| Disabled | `opacity-disabled`, no pointer events, label kept. Prefer saying why an action is unavailable over disabling it silently. |
| Loading | Keeps its size and label, shows a spinner in place of its icon, sets `aria-busy` and ignores clicks. Only when the action takes over 300ms. |
| Selected | `brand-soft` with `brand` text, or the control's own checked look. |
| Error | `danger` border and a sentence that says how to fix it. Never colour alone. |

## Data states

Every component or screen that shows data handles five states. Each component's guideline says what shape it takes in them; the app decides when.

| State | What shows |
|---|---|
| Loading, first time | Nothing for 300ms, then a `Skeleton` in the final shape. Once shown, it stays at least 500ms, so it does not flash. |
| Refreshing | The current data stays, with a quiet sign in the header ("Updating…"). Never replace data the person is reading with a skeleton. |
| Empty | An `EmptyState` of one of three kinds. **First use**: what will appear here and the action that starts it. **No results**: what was searched and "Clear filters". **Done**: "All bills paid this month", a success and not an absence. |
| Error | At the level that failed. A field: the `Input` error. A card or section: a `Banner` inside it, saying what failed, with "Try again", while the rest of the screen keeps working. An action: a `Toast` that stays until dismissed. The whole screen: only when nothing loaded. |
| Offline or stale | The last data stays, with a `warning` `Banner` saying since when: "No connection. Showing data from 10:42". |

## Charts

Charts are part of the visual system, not a style of their own:

- The background is the card's, with no frame of its own. Grid `chart-grid`, at most 3 horizontal lines. No vertical grid.
- Axis text in `text-muted`, 11px, tabular numbers, abbreviated values.
- The brand series is `brand`. Categories use `cat-*`. A moving average is `warning`. Reference, limit and ideal pace are dashed `text-muted`. Neutral bars are `chart-bar` (3:1 on `surface`), and the focused bar is `text`.
- A line's end point is marked with a hollow circle. The value marker is a `solid` `Badge`.
- Dark tooltip (`text` on `bg`, inverted), with date, amount and the why.
- Every chart has an `aria-label` stating the conclusion ("R$ 200 under pace"), not a description of the drawing.
- Three shapes cover v1: `PaceChart` (cumulative vs pace), `DonutChart` (distribution) and `BarChart` (series with average and target). A new chart starts from one of them.

## Layout and responsiveness

- **Desktop first.** Breakpoints: `bp-wide` 1280 (full sidebar), `bp-desktop` 1024 (icon-only sidebar), `bp-tablet` 768 (top bar with a menu). Below 768 the bottom bar takes over.
- Content area up to `content-max`, padding `space-32` on desktop and `space-16` on phones. Card grid gap `space-24` on desktop and `space-16` on phones.
- Detail and actions open in the `Sheet`: a right side panel (`panel-width`) on desktop, a bottom sheet on phones. `Dialog` only to confirm something destructive.
- Rare actions sit in a `Menu` or mode, not on every row.
- Layering, from low to high: `z-sticky` (top and bottom bars), `z-overlay` (Sheet, Dialog), `z-popover` (Menu, Select, which can open inside a Sheet), `z-toast`, `z-tooltip`. Never a literal z-index.
- Tables are for desktop. Below `bp-tablet` the app shows the rows as a list (a money app uses `ListRow`), or fewer columns.

## Content and voice

- pt-BR first, English at parity. Write with pt-BR in mind: its words are longer and it is what breaks layouts. Between two equally clear options, use the shorter one.
- Talk to the person ("You can still spend"), in short, direct sentences. Verb first on buttons ("Mark as paid").
- Errors say what happened and how to fix it, without apologising: "Couldn't connect to Nubank. Try again".
- Code, routes, tokens and component names are in English (`/accounts`, `/net-worth`, `AlertCard`). Only interface copy is translated.

## Implementation

- Package `@homeowner/bedrock` in `/bedrock`, in an npm workspace, used by Revenue first. web and admin migrate later.
- Core lives in `src/components/` and is exported from `@homeowner/bedrock`. Finance lives in `src/finance/` and is exported from `@homeowner/bedrock/finance`. Core never imports Finance.
- Base: **shadcn/ui** components (Radix + Tailwind 4) copied into the package and restyled with these tokens. Icons from `lucide-react`. The phone sheet uses `vaul`. Charts use Recharts through shadcn's `ChartContainer`.
- Tokens become CSS custom properties with the same names (`--surface`, `--space-16`) and are exposed to Tailwind through `@theme`. No literal colour, spacing or z-index in a component.
- Accessibility comes from the Radix primitives (focus, keyboard, ARIA). Never replace a primitive with a `div` with an `onClick`.
- `components/bundle.css` is the visual contract. The code implementation must match it.

## Versioning and changes

- The package follows semver from its first release. Removing or renaming a token, component or prop is a major. Adding one is a minor. A fix is a patch. Before 1.0.0, a minor may break.
- Every change to this folder or to the package adds a line to `bedrock/CHANGELOG.md`, under the next version.
- To remove something, mark it `deprecated` in its guideline and in the Inventory, naming what replaces it. Remove it in the next major.
- A new component joins Core when a second app needs it, or when the spec itself depends on it. Until then it lives in the app. Finance takes what only money apps need.
- Each guideline has, in order: a one-sentence summary; when to use it and when not; variants and sizes; states (interaction and data); content rules; accessibility (keyboard, ARIA, what a screen reader hears); what the consumer provides; and the implementation base.

### Inventory

`draft` is in the spec only. `stable` is shipped in the package. `deprecated` is on its way out.

| Component | Layer | Status |
|---|---|---|
| Button | Core | stable |
| Input | Core | stable |
| SearchField | Core | stable |
| Select | Core | stable |
| SegmentedControl | Core | stable |
| Switch | Core | stable |
| Card | Core | stable |
| Badge | Core | stable |
| ProgressBar | Core | stable |
| Table | Core | stable |
| Banner | Core | stable |
| EmptyState | Core | stable |
| Skeleton | Core | stable |
| Toast | Core | stable |
| Tooltip | Core | stable |
| Menu | Core | stable |
| Sheet | Core | stable |
| Dialog | Core | stable |
| Sidebar | Core | stable |
| BottomBar | Core | stable |
| ChartContainer | Core | stable |
| Amount | Finance | stable |
| MoneyInput | Finance | stable |
| CategoryTag | Finance | stable |
| StatCard | Finance | stable |
| ListRow | Finance | stable |
| AlertCard | Finance | stable |
| PaceChart | Finance | stable |
| DonutChart | Finance | stable |
| BarChart | Finance | stable |
