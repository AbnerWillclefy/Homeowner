# BottomBar

Phone navigation (< `bp-tablet`): fixed tabs at the bottom.

- **When to use**: the top-level destinations on a phone. **When not**: on tablet and desktop (use `Sidebar`), or for actions on one screen (use `Button`).
- **Variants**: four tabs, never five: Home · Transactions · Plan · More (pt-BR: Início · Lançamentos · Planejar · Mais). "Plan" opens a screen with Goals, Net worth, Projection and Sources; "More" holds Bills to pay, Card bills, Spending Categories, Pantry and Settings. Bills to pay also opens from the Overview card.
- **Size**: 20px icon + `11px` label. Touch target ≥ 48px. Respects `env(safe-area-inset-bottom)`, which needs `viewport-fit=cover` in the app's viewport meta.
- **States**: hover and pressed in `surface-hover`, the `focus` ring, and the current tab in `brand`.
- **Badge**: an item with `badge` shows its count on the tab icon, with the same sr-only `label` in the link name. A destination inside "More" puts its count on the "More" tab, and on its own row inside "More".
- **Content**: one short word per tab that fits whole, in pt-BR and English, at 320px wide (80px a tab). A label never truncates: if it does not fit, the word changes.
- **Accessibility**: a native `<nav>` with a label from the consumer, unique on the page. Each tab is a real link, and the current one has `aria-current="page"`. Tab reaches every tab; Enter follows the link.

The consumer provides the label, the items (`href`, label, icon, current) and optionally `onNavigate`, so the package never knows the router. The app positions the bar; with a fixed bar it uses `z-sticky`. Implementation: a native `<nav>` on the tokens.
