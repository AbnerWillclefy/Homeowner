# Input

A text or amount field, always with a visible label above.

- Label in `label` / `text-muted`; hint in `caption` below; an error replaces the hint, in `danger`, with an icon and one sentence saying how to fix it.
- **MoneyInput** (`br-input--money`): `R$` prefix, tabular numbers, 48px, numeric keyboard on phones. Accepts "1.234,56" and "1234.56"; always displays in the pt-BR format.
- Background `surface-sunken`, border `border-strong` (3:1). Focus: the `focus` ring.
- Validate on leaving the field, not on every keystroke.

The consumer provides `label`, `value`, `onChange`, `hint` and `error`. Implementation: shadcn/ui `Input` + `Label` + `Form`.
