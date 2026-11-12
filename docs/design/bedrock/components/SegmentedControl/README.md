# SegmentedControl

A choice between 2 to 5 short, exclusive options, with the pill showing the chosen one.

- **When to use**: chart periods **7D · 30D · 90D · 1Y**, status filters **All · Paid · Pending · Late**. **When not**: more than 5 options or long labels (use `Select`), or on and off (use `Switch`).
- **Variants**: `block` takes the full width on phones. Items are 32px tall with a 48px hit area.
- **States**: hover and pressed share one token; the `focus` ring; selected is the pill. One option is always selected: pressing the selected one does nothing. The pill moves in `duration-base` / `ease-standard`; no motion with `prefers-reduced-motion`. The first release fades the pill instead of sliding it.
- **Content**: a word or a short code per option, never a sentence.
- **Accessibility**: a group with a name from the consumer. Arrow keys move focus between options and loop; Space and Enter select. Focus alone does not select. The selected option is exposed to assistive technology by the Radix pattern, with no ARIA added on top.

The consumer provides the group name, the options and the value. Implementation: shadcn/ui `ToggleGroup` (single).
