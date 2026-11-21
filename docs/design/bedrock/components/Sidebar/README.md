# Sidebar

Desktop navigation: the brand mark on top, two groups, a note and Settings at the bottom.

- **When to use**: the top-level destinations from `bp-desktop` up. **When not**: on phones (use `BottomBar`).
- **Variants**: ≥ `bp-wide` (1280px): full, `sidebar-width`. Between `bp-desktop` and `bp-wide`: icons only, `sidebar-collapsed`, with a `Tooltip` on hover and focus. Below `bp-desktop`: it disappears and becomes a top bar with a menu; the app's layout does this.
- **Anatomy**: a 16px lucide icon + label, and optionally a count badge (`badge`) pushed right in `warning`, capped at "9+"; in the icon-only rail it sits on the icon. The brand is `SidebarBrand`: a 24px `brand` square plus the name, mark only in the rail. A `note` (muted `caption`, such as "Updated 2 h ago") sits above Settings and is hidden in the rail. Groups in `overline`: MAIN and PLANNING.
- **States**: hover and pressed in `surface-hover`; the `focus` ring. Active item: `brand-soft` + `brand`, with `aria-current="page"`. Items are 48px tall on touch screens.
- **Content**: items only for screens that exist. A future feature gets no "coming soon" item. A long label truncates.
- **Accessibility**: a native `<nav>` with a label from the consumer, unique on the page. Each group is a list named by its overline. Items are real links: Tab reaches them, Enter follows them. When collapsed, the labels stay in the accessible name. The badge count is `aria-hidden`; its `label` ("3 bills open") is sr-only text (", " then the label) in the link, so the name reads "Bills to pay, 3 bills open".

The consumer provides the label, the brand, the groups of items (`href`, label, icon, current), the footer items, an optional note and optionally `onNavigate`. Implementation: a native `<nav>` on the tokens, not shadcn's Sidebar block.
