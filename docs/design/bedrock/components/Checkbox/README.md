# Checkbox

Marks one item as done or chosen, with a save of its own or none ("checked off the list").

- **When to use**: ticking items in a list (a shopping list), or choosing several of many. **When not**: a setting that applies at once (use `Switch`); choosing one of few (use `SegmentedControl`).
- **Variants**: one. Unchecked: `surface-sunken` box with a `border-strong` border. Checked: `brand` fill with a check. The box is 24px with a 48px hit area; the row is 48px tall.
- **States**: hover and pressed on the box; the `focus` ring; disabled; checked. The fill changes in `duration-fast`, without motion under `prefers-reduced-motion`.
- **Content**: the label says what is chosen ("Arroz 5 kg"), not "Select". In a list row whose own text already names the item, the label stays for screen readers only (`hideLabel`).
- **Accessibility**: announced as a checkbox with its label tied to it by a native label, so tapping the text toggles it too. Space toggles it.
- **In a list**: the check-off row is a `ListRow` with a Checkbox in its leading slot, composed by the app; there is no separate component.

The consumer provides the label, `checked` and `onCheckedChange`. Implementation: shadcn/ui `Checkbox` (Radix).
