# Admin design system

The look of `admin/`, as built. The PWA follows `DESIGN.md`; nothing here applies to it. Started from ui-ux-pro-max (`--design-system --density 8 --variance 3 --motion 2`, 2026-10-30) and kept only what the admin uses.

## Style

Swiss minimalism for a dense, desktop-first dashboard: a grid, hairline borders, small uppercase labels, no shadows, no decoration.

## Colour

Values live in one place, `admin/src/index.css`, as overrides of the shared semantic tokens (`surface`, `surface-raised`, `text`, `muted`, `accent`, `accent-contrast`, `danger`, `warning`, `focus`, `border`). Components use those names, never raw colours.

- Slate neutrals with a status green as `accent`, in a dark and a light theme that follow the system setting.
- `warning` is admin-only, for the warn badge.
- Status colours are at least 4.5:1 as text on `surface-raised` in both themes, checked by `src/shared/StatusBadge.test.tsx`.

## Type

- Fira Sans for text and Fira Code for headings and figures (`font-mono`, `tabular-nums`), self-hosted with `@fontsource`.
- Base size 16px; labels and table headers are `text-xs` uppercase.

## Shape and spacing

- Radii: `--radius-control` 0.375rem, `--radius-card` 0.5rem.
- Dense spacing (cards `p-4`, rows `py-1.5`); 44px minimum targets for anything clickable.

## Motion

150ms colour and transform transitions only, always behind `motion-safe:`.

## Charts

- Recharts, one style per series: lines differ by dash style as well as colour, so a chart reads without colour. At most three series.
- Each chart sits in a `role="img"` wrapper whose `aria-label` is a text summary, with Recharts' accessibility layer off. The full numbers stay in a `DataTable` next to it.
- In a sparkline, a `null` day is a gap, never a zero.

## Checklist

- [ ] SVG icons only, `aria-hidden` when decorative; no emoji.
- [ ] Status shown with text and an icon, not colour alone.
- [ ] Visible focus on every control; keyboard reachable.
- [ ] Text 4.5:1 in both themes.
- [ ] Works at 1024px and 1440px with no horizontal scroll.
