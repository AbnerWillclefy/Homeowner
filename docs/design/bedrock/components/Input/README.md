# Input

A text or amount field, always with a visible label above.

- **When to use**: free text or an amount. **When not**: a choice from a list (use `Select`), a few exclusive options (use `SegmentedControl`), or searching a list (use `SearchField`).
- **Variants**: **Input**, and **MoneyInput** (`br-input--money`): `R$` prefix, tabular numbers, 48px, numeric keyboard on phones. It accepts "1.234,56" and "1234.56" and yields cents. It rejects negative amounts; zero is valid, and a field that cannot take zero passes an error.
- **Look**: background `surface-sunken`, border `border-strong` (3:1). Text is 16px on touch screens, because iOS Safari zooms into smaller fields on focus. The target is 48px on touch screens.
- **States**: the `focus` ring; disabled; error. Validate on leaving the field, not on every keystroke. MoneyInput reformats on blur, not while typing.
- **Content**: label in `label` / `text-muted`; hint in `caption` below; an error replaces the hint, in `danger`, with an icon and one sentence saying how to fix it.
- **Accessibility**: a native label tied to the field. The field is described by the error when there is one, and by the hint otherwise, and is marked invalid on error. The error is announced when it appears. The `R$` prefix is `aria-hidden`; the label carries the meaning.

The consumer provides `label`, `value`, `onChange`, `hint` and `error`; MoneyInput takes `value` in cents (or none when empty) and `onValueChange`, and displays pt-BR by default. Implementation: a native `<label>` and `<input>` on the tokens.
