# Select

A choice of one value from a list too long or too wordy for a `SegmentedControl`: more than 5 options, or long labels.

- **When to use**: an account, a category, a month. **When not**: 2 to 5 short options (use `SegmentedControl`), on and off (use `Switch`), or a list to search (use `SearchField`).
- **Trigger**: looks like an `Input`: the label above, `surface-sunken`, `border-strong`, 40px, the chosen value and a `chevron-down` on the right. Without a value it shows a placeholder in `text-muted`.
- **List**: the `Menu` look; the selected item carries a `check` in `brand`. It sits on `z-popover`.
- **States**: hint, error (as `Input`), and disabled. Text is 16px on touch screens.
- **Accessibility**: the label is tied to the trigger. Arrow keys move, `Enter` selects, `Esc` closes, typing jumps to an option. On phones the native picker is acceptable.

The consumer provides `label`, `options`, `value`, `onValueChange`, `hint` and `error`. Implementation: shadcn/ui `Select` (Radix).
