# Switch

Turns something on or off that applies at once, with no save button.

- **When to use**: a setting that takes effect immediately ("Reminder 3 days before"). **When not**: choosing between two different things (use `SegmentedControl`).
- **Variants**: one. Off: `surface-sunken` track with a `border-strong` border. On: `brand`. The row is 48px tall.
- **States**: hover and pressed on the track; the `focus` ring; disabled; selected is on. The thumb moves in `duration-base`, without motion under `prefers-reduced-motion`.
- **Content**: the label on the left says what is on, not "Enable".
- **Accessibility**: announced as a switch, with its label tied to it by a native label. Space toggles it; Enter does too.

The consumer provides the label, `checked` and `onCheckedChange`. Implementation: shadcn/ui `Switch` (Radix).
