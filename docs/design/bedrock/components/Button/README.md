# Button

An action button: a verb that says what happens.

- **When to use**: any action the person triggers. **When not**: navigation to another screen (use a link), a choice between options (use `SegmentedControl`), or on and off (use `Switch`).
- **Variants**:
  - **primary** (`brand` + `on-brand`): at most one per screen or sheet, for the action the screen exists for ("Mark as paid", "Connect bank").
  - **secondary**: supporting actions beside the primary. **ghost**: tertiary and toolbar actions.
  - **danger**: only inside a Dialog that confirms something destructive, never loose on the screen.
  - **success**: a transient state after the action succeeded ("✓ 3 bills paid"), for `duration-base`, then it reverts or disappears.
- **Sizes**: `sm` 32px (dense bars), default 40px (desktop), `lg` 48px (phone and onboarding). The hit area is 48px at every size.
- **States**: hover and pressed share one token. The `focus` ring on `:focus-visible`. Disabled uses `opacity-disabled`; prefer saying why the action is unavailable. **Loading**, for an action that takes over 300ms, keeps its size and label, shows a spinner in place of the icon, sets `aria-busy` and ignores clicks.
- **Content**: verb first, sentence case, no full stop.
- **Accessibility**: a native `<button>` that defaults to `type="button"`, so it never submits a form by accident. Space and Enter activate it. It must have text: an icon-only button (header actions such as notifications, add, hide amounts) is a ghost Button with a visually hidden label. Rendered as a link (`asChild` on `<a>`), Space does not activate it.

The consumer provides the text, the optional leading icon and the `onClick`. Implementation: shadcn/ui `Button` with the variants above.
