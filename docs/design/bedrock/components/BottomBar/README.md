# BottomBar

Phone navigation (< `bp-tablet`): fixed tabs at the bottom.

- **When to use**: the top-level destinations on a phone. **When not**: on tablet and desktop (use `Sidebar`), or for actions on one screen (use `Button`).
- **Variants**: three to five tabs; Homeowner uses four: Overview · Transactions · Planning · More. "Planning" opens a screen with Goals, Net worth, Projection and Accounts; "More" holds Bills to pay, Card bills, Categories and Settings.
- **Size**: 20px icon + `11px` label. Touch target ≥ 48px. Respects `env(safe-area-inset-bottom)`, which needs `viewport-fit=cover` in the app's viewport meta.
- **States**: hover and pressed in `surface-hover`, the `focus` ring, and the current tab in `brand`.
- **Content**: one short word per tab. A long label truncates with an ellipsis; its full text stays in the accessible name.
- **Accessibility**: a native `<nav>` with a label from the consumer, unique on the page. Each tab is a real link, and the current one has `aria-current="page"`. Tab reaches every tab; Enter follows the link.

The consumer provides the label, the items (`href`, label, icon, current) and optionally `onNavigate`, so the package never knows the router. The app positions the bar; with a fixed bar it uses `z-sticky`. Implementation: a native `<nav>` on the tokens.
