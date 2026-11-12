# Menu

A list of actions behind a button: where rare actions live, so they are not on every row.

- **When to use**: two or more actions that are not the screen's main one ("Edit", "Change category", "Delete"). **When not**: choosing a value (use `Select` or `SegmentedControl`), or navigation (use links).
- **Trigger**: a `ghost` icon Button with `ellipsis` and an `aria-label` ("More actions").
- **Items**: 40px tall, an optional 16px icon, verb first. A destructive item is last, in `danger`, after a separator, and it opens a `Dialog`.
- **Look**: `surface-raised`, `border`, `radius-md`, `shadow-overlay`, padding `space-4`. It sits on `z-popover`.
- **States**: an item has hover and keyboard highlight in `surface-hover`, and disabled with `opacity-disabled`.
- **Accessibility**: arrow keys move between items, `Enter` runs one, `Esc` closes and returns focus to the trigger, typing a letter jumps to an item. Radix gives `role="menu"` and `menuitem`.
- **Phone**: below `bp-tablet` the same items open in the `Sheet`, with 48px rows.

The consumer provides the trigger label and the items (label, icon, `onSelect`, `danger`). Implementation: shadcn/ui `DropdownMenu` (Radix).
