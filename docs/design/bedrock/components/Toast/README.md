# Toast

A short confirmation of something that just happened, with undo when possible.

- **When to use**: the result of an action ("Category changed to Groceries"). **When not**: an error that belongs to a section (use `Banner`), or a confirmation before a destructive action (use `Dialog`).
- **Tones**: `neutral`, `positive` and `danger`, each with its icon, and the text carries the meaning. Error: a `danger` icon and what to do ("Couldn't connect to Nubank. Try again").
- **Placement**: bottom right on desktop, bottom centre on phones, above the bottom bar.
- **States**: a toast without an action disappears after 5s, and the timer pauses while the pointer is over it or focus is inside. A toast with an action, which includes every error, stays until the person acts on it or dismisses it. Entrance is without motion under `prefers-reduced-motion`.
- **Content**: one past-tense sentence + "Undo" when the action is reversible. That is how the app avoids asking for confirmation.
- **Accessibility**: `danger` is announced at once (assertive); the others politely. `Esc` dismisses a focused toast, and F8 moves focus to the toasts. The action is a `Button` that also says how to do it elsewhere, for screen readers. The close button has a label from the consumer. A toast with an action never times out, so a keyboard or screen-reader user can reach it.

The consumer provides `open`, the tone, the title, the optional description and action, and the close label, inside a provider with the viewport's label. There is no global `toast()` call: the app renders the toast from its own state. Implementation: Radix `Toast`.
