# Changelog

Bedrock follows semver; before 1.0.0 a minor may break ([spec](../docs/design/bedrock/README.md)).

## Unreleased

- ProgressBar takes `tone="brand"`, a fill that stays calm near full, for progress toward a goal.

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
