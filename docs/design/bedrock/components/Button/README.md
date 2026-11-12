# Button

An action button: a verb that says what happens.

- **primary** (`brand` + `on-brand`): at most one per screen or sheet, for the action the screen exists for ("Mark as paid", "Connect bank").
- **secondary**: supporting actions beside the primary. **ghost**: tertiary and toolbar actions.
- **danger**: only inside a Dialog that confirms something destructive, never loose on the screen.
- **loading**: for an action that takes over 300ms. Keeps its size and label, shows a spinner in place of the icon, sets `aria-busy` and ignores clicks.
- **success**: a transient state after the action succeeded ("✓ 3 bills paid"), for `duration-base`, then it reverts or disappears.
- Sizes: `sm` 32px (dense bars), default 40px (desktop), `lg` 48px (phone and onboarding). The hit area is 48px at every size.
- Pressed looks like hover. Disabled uses `opacity-disabled`; prefer saying why the action is unavailable.
- A round **IconButton** for header actions (notifications, add, hide amounts). Always with an `aria-label`.

The consumer provides the text (verb first, sentence case), the optional leading icon and the `onClick`. Implementation: shadcn/ui `Button` with the variants above.
