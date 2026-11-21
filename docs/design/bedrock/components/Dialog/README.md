# Dialog

Confirmation of something destructive or irreversible. Only that.

- **When to use**: disconnecting an account, deleting data. **When not**: everything else. Do it and offer Undo in a `Toast`; for detail or a form, use `Sheet`.
- **Variants**: one. The overlay is `scrim`, the content `surface-raised`, at most 440px wide.
- **States**: opens with a fade and zoom, without motion under `prefers-reduced-motion`. Clicking the scrim does not close it. The buttons follow `Button`.
- **Content**: the title states the consequence ("Disconnect Nubank?"), the body says what is lost and what stays. Buttons: "Cancel" (secondary) and the action in `danger` with the exact verb ("Disconnect").
- **Accessibility**: announced as an alert dialog with its title and description. Focus is trapped while open and starts on Cancel. `Esc` closes it. Focus returns to what opened it.

The consumer provides `open`, the title, the description, both button labels and `onConfirm`, and optionally the trigger. Implementation: shadcn/ui `AlertDialog` (Radix).
