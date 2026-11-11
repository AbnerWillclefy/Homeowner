# Bedrock

Bedrock is the shared design system of the Homeowner apps: Revenue (finance), the Homeowner PWA and the admin. It defines tokens, components and rules. Each app has its own screens built on top of it.

Dark is the primary theme and comes first. Light is derived from it, with the same care. Apps open in the operating system's theme and use dark when there is no preference.

`tokens.json` holds every token with its usage note, `tokens.css` is the same as CSS custom properties, and `components/bundle.css` is the visual contract the reference renders were drawn with. The editable source is the Bedrock design system artifact; this folder is its English copy for the repo.

## Principles: the 8 golden rules

Every screen and component follows Shneiderman's 8 golden rules of interface design. Here is how each shows up in Bedrock:

| Rule | How Bedrock meets it |
|---|---|
| 1. Strive for consistency | One token per decision, one component per pattern. A category has the same colour and icon in every chart, list and filter. Amounts always go through `Amount`. Detail always opens in the `Sheet`. |
| 2. Serve all users | Desktop first, but every component has a phone form. Desktop shortcuts (`/` search, `Esc` close, arrows in the segmented control). Touch targets ≥ 48px. pt-BR and English. AA contrast in both themes. |
| 3. Offer informative feedback | Every action changes something visible within `duration-base`: the button turns `success`, the row gets a ✓, a `Toast` confirms. Loads over 300ms show a `Skeleton` in the final shape. |
| 4. Design dialogs to yield closure | Flows with a clear start, middle and end. The `AlertCard` opens the sheet, the action happens, the sheet shows the result and the card behind it updates. Onboarding shows the current step and how many are left. |
| 5. Prevent errors | `MoneyInput` only accepts amounts. Limits and goals reject zero or negative. Validation on leaving the field, with the fix written out. Destructive actions only inside a `Dialog`. |
| 6. Permit easy reversal | Reversible changes (category, mark as paid, edit amount) happen at once with "Undo" in the `Toast`. That is why almost nothing asks for confirmation. |
| 7. Keep users in control | Nothing changes by itself on the screen the person is reading. Sync updates in the background and says so. An amount edited by hand wins over the bank's until the person chooses "use the bank's amount". |
| 8. Reduce short-term memory load | Summary before detail. Active filters visible as chips. Context comes with the number (`/ R$ 4.983`, "R$ 98 per day"). Labels always visible. Never rely on remembering what was on a previous screen. |

## 8px grid

- Every outer space (between components, card padding, page margins) is a multiple of 8: `space-8`, `space-16`, `space-24`, `space-32`, `space-40`, `space-48`, `space-64`.
- `space-4` is the half step, allowed only inside components: icon↔text, vertical padding of badges and tokens, gap between sidebar items.
- Control heights: `control-sm` 32, `control-md` 40, `control-lg` 48. Text line heights in multiples of 4 (16, 20, 24, 32, 40, 48).
- Radii: `radius-sm` 4, `radius-md` 8, `radius-lg` 16, `radius-xl` 24, `radius-full`.
- Icons at 16px (12px inside a badge, 20px in the bottom bar).
- Values off the scale need a written reason in the code. Space comes from `gap` in flex and grid, never from a margin on each element.

## Colour

- **Structure**: the page is `bg`, content sits on `surface` (cards, sidebar), and what floats sits on `surface-raised` (sheet, popover, tooltip). Inputs and tracks use `surface-sunken`. In dark, separation comes from the colour step, with no shadow.
- **Text**: `text` for everything read, `text-muted` for labels, captions and references. Both pass 4.5:1 on every surface in both themes. There is no third, fainter level.
- **Brand**: `brand` is Homeowner green. It appears on the primary action, the active navigation item, links and the brand line in charts. In dark the green is light, so text on it is a dark `on-brand`, never white.
- **Hero**: `hero` is the only saturated block on a screen, reserved for the card that answers the screen's question ("how much can I still spend"). On it: text `on-hero` and `on-hero-muted`, chart line `hero-line`.
- **State**: `positive`, `warning` and `danger`, each with its `-soft` for badge backgrounds. State always comes with a word or icon, never colour alone. Normal spending is not red: `danger` is only for late, over-limit and error.
- **Categories**: 13 fixed colours (`cat-housing`, `cat-groceries`…), each with a `-soft`. They are the same in chart, icon, legend and filter, on every screen. All pass 4.5:1 on `surface`, so they also work as text colour.
- **Focus**: a 2px solid `focus` ring with a 2px offset on every focusable element. It passes 3:1 on every surface.

## Typography

- One family: **Inter**, bundled through `@fontsource`, with the system stack as fallback. Weights 400, 500 and 600. 700 only for the app name.
- Numbers are always tabular (`font-variant-numeric: tabular-nums`), so columns and changing values stay aligned.
- Scale: `page-title` 24/32 · `section-title` 18/24 · `card-label` 14/20 · `value-hero` 40/48 · `value-lg` 32/40 · `value-md` 20/24 · `value-sm` 14/20 · `body` 14/20 · `body-strong` 14/20 · `caption` 12/16 · `label` 12/16 · `overline` 11/16.
- One `page-title` per screen, one `value-hero` per screen. A card's label is `card-label` in `text-muted`, never a large title.
- Sentence case everywhere. Uppercase only in the `overline` of sidebar groups.

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

## Charts

Charts are part of the visual system, not a style of their own:

- The background is the card's, with no frame of its own. Grid `chart-grid`, at most 3 horizontal lines. No vertical grid.
- Axis text in `text-muted`, 11px, tabular numbers, abbreviated values.
- The brand series is `brand`. Categories use `cat-*`. A moving average is `warning`. Reference, limit and ideal pace are dashed `text-muted`. Neutral bars are `surface-hover`, and the focused bar is `text`.
- A line's end point is marked with a hollow circle. The value marker is a `solid` `Badge`.
- Dark tooltip (`text` on `bg`, inverted), with date, amount and the why.
- Every chart has an `aria-label` stating the conclusion ("R$ 200 under pace"), not a description of the drawing.
- Three shapes cover v1: `PaceChart` (cumulative vs pace), `DonutChart` (distribution) and `BarChart` (series with average and target). A new chart starts from one of them.

## Layout and responsiveness

- **Desktop first.** Breakpoints: `bp-wide` 1280 (full sidebar), `bp-desktop` 1024 (icon-only sidebar), `bp-tablet` 768 (top bar with a menu). Below 768 the bottom bar takes over.
- Content area up to `content-max`, padding `space-32` on desktop and `space-16` on phones. Card grid gap `space-24` on desktop and `space-16` on phones.
- Detail and actions open in the `Sheet`: a right side panel (`panel-width`) on desktop, a bottom sheet on phones. `Dialog` only to confirm something destructive.
- Rare actions sit in a menu or mode, not on every row.

## Content and voice

- pt-BR first, English at parity. Write with pt-BR in mind: its words are longer and it is what breaks layouts. Between two equally clear options, use the shorter one.
- Talk to the person ("You can still spend"), in short, direct sentences. Verb first on buttons ("Mark as paid").
- Errors say what happened and how to fix it, without apologising: "Couldn't connect to Nubank. Try again".
- Code, routes, tokens and component names are in English (`/accounts`, `/net-worth`, `AlertCard`). Only interface copy is translated.

## Implementation

- Package `@homeowner/bedrock` in `/bedrock`, in an npm workspace, used by Revenue first. web and admin migrate later.
- Base: **shadcn/ui** components (Radix + Tailwind 4) copied into the package and restyled with these tokens. Icons from `lucide-react`. The phone sheet uses `vaul`. Charts use Recharts through shadcn's `ChartContainer`.
- Tokens become CSS custom properties with the same names (`--surface`, `--space-16`) and are exposed to Tailwind through `@theme`. No literal colour or spacing in a component.
- Accessibility comes from the Radix primitives (focus, keyboard, ARIA). Never replace a primitive with a `div` with an `onClick`.
- `components/bundle.css` is the visual contract. The code implementation must match it.
