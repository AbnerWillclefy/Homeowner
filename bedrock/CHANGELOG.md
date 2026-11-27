# Changelog

Bedrock follows semver; before 1.0.0 a minor may break ([spec](../docs/design/bedrock/README.md)).

## Unreleased

- Core: `Sheet` grows five optional props, all defaulting to today's behaviour: `leading` (drawn before the title, a large icon), `tools` (drawn before the close button, a ⋯ `Menu`), `dismissible` (false while a write is in flight: no drag, Escape or outside tap, and a disabled close button), `closeButton` (false draws no ✕) and `size` (`full` is 92% of a phone's height). Opening a `Sheet` now moves focus to the panel itself in both trees (vaul left it on the opener), so a keyboard or screen reader starts at its title.

- Core: `SectionHeading` (the name of a group of rows: `variant` is required, `title` for the 18px heading and `label` for the 12px muted caption; optional `end` item in the row, `as` `h2` or `h3`, `id`). Its root carries `data-slot="section-heading"`. The overlays of `Sheet` (both trees) and `Dialog` carry `data-slot="scrim"`, so the pairs measure them.

- Core: `List` and `Row` (the `hm-list` card and `hm-item` row: optional leading, title, caption and trailing; 64px tall, 56px without a leading element; `asChild` for a button or link; title and caption truncate). The roots of `List`, `Row`, `PageHeader`, `Sheet`, `Dialog`, `SearchField`, `Field`, `SegmentedControl`, `Toast`, `BottomBar` and finance `ListRow` carry `data-slot` (`list`, `row`, `page-header`, `sheet`, `dialog`, `search-field`, `field`, `segmented-control`, `toast`, `bottom-bar`, `list-row`), part of the public markup. Off-grid spacing fixed: `PageHeader` gaps 8px/16px, field padding 16px, `SearchField` icon at 16px, `Toast` icon margin 4px.

- Home layer, exported as `@homeowner/bedrock/home`: `ChoreTag` (and the bare `ChoreIcon`), `Effort`, `Energy` (the chip, plus `EnergyBars` for a `Choice`'s `leading`), `Streak` and `TaskCard`. All are presentational: every string and Task fact is a prop, and `Effort`, `Energy` and `Streak` require their accessible name. `TaskCard` takes its actions and ⋯ menu from the caller. New `chore-*` tokens (10 Categories, each with a `-soft` pair, in both themes) sit beside `cat-*`; `tokens.test.ts` checks them against `docs/design/bedrock/tokens.json`, and `layers.test.ts` keeps Core and Home apart.

- Core: `Avatar` (photo, initials or icon; the fill and ink come as props, the image falls back to the initials on error), `StepIndicator` ("Passo N de M" as a prop string plus decorative segments), `ChoiceGroup` and `Choice` (large 48px tap choices on native radios, a check icon marks the selected one) and `PageHeader` (title, subtitle, `id`, `headingRef`, `period`, `tools`, `action`, `trailing`). `Stepper` is also exported as `Counter`, the canvas's name for it. `Choice` takes an optional `leading` visual; `Select` takes an optional `icon`, which draws its trigger as a secondary button.

- Phone controls: below 768px (and on touch screens) Button `sm` and `md`, every field and the Select trigger are drawn at 48px, and SegmentedControl is 48px overall, so a field beside a button match. Desktop heights are unchanged. BottomBar labels no longer truncate.
- ListRow: optional `action` (`{ label, icon, onClick, loading, disabled, variant }`), a sibling button after the row: a text Button from the tablet breakpoint up, a 48px icon button below it, the label as its accessible name. Rows without it render as before.
- DescriptionList (Core): label and value pairs as a two-column `<dl>`, with an optional total line; values are nodes, so `Amount` follows hide values.
- Spec only (from the Revenue phone audit): PageHeader (Core, draft); BottomBar takes four tabs whose labels never truncate; ListRow gets one row action and a one-line caption; controls side by side share one height and are 48px on phones; no screen scrolls sideways; every screen has a phone artboard before it is built.

## 0.5.0

- Checkbox and Stepper (Core): a labelled check box for ticking items off a list, and a minus and plus quantity control with a minimum, a step (0,001 for kilograms) and a disabled state. They are Core because `web/` needs the same form primitives.

## 0.4.0

- Select: optional `hideLabel` keeps the label for screen readers only, for a field whose value already names it (a month).

## 0.3.0

- NavItem: optional `badge` (`{ count, label }`) shows a warning count on the Sidebar (beside the label, or on the icon in the rail) and on the BottomBar tab; `label` joins the link's accessible name. A count of 0 shows nothing.
- Sidebar: optional `note` above the footer (hidden in the rail), and the exported `SidebarBrand` (mark plus name).

## 0.2.0

- ProgressBar: optional `tone` fixes the fill colour, so a bar that must not alarm stays `brand` past its target.

## 0.1.0

The first release: the tokens and the 30 components of the spec's Inventory, all `stable`.

### Tokens (`@homeowner/bedrock/tokens.css`)

- Colour: primitives (`neutral-*`, `green-*`, `amber-*`, `red-*`, `blue-*`) and semantic tokens for dark (on `:root`, the default) and light (`[data-theme="light"]`): `bg`, the `surface` family, `border`, `border-strong`, `text`, `text-muted`, `brand`, `hero`, `positive`, `warning`, `danger` with their `on-` and `-soft` pairs, `focus`, `scrim`, `chart-grid`, `chart-bar`, the 13 `cat-*` category colours with their `-soft`, and two shadows. Only semantic colours become Tailwind utilities.
- Space (`space-*`, 4px base), control heights (`control-sm`, `-md`, `-lg`), layout widths, breakpoints (`tablet`, `desktop`, `wide`), radius, easing and duration, z-index and the disabled opacity.
- Inter (400, 500, 600, 700) and the type utilities `page-title`, `section-title`, `card-label`, `value-hero`, `value-lg`, `value-md`, `value-sm`, `body`, `body-strong`, `caption`, `label` and `overline`, plus `touch-target` (a 48px hit area).

### Core (`@homeowner/bedrock`)

Button, Input, SearchField, Select, SegmentedControl, Switch, Card, Badge, ProgressBar, Table, Banner, EmptyState, Skeleton, Toast, Tooltip, Menu, Sheet, Dialog, Sidebar, BottomBar and ChartContainer.

### Finance (`@homeowner/bedrock/finance`)

Amount, MoneyInput, CategoryTag, StatCard, ListRow, AlertCard, PaceChart, DonutChart and BarChart.

### Showcase

28 sections, one per component except ChartContainer (seen inside the three charts) and MoneyInput (in the Input section), each in both themes and in pt-BR and English.
