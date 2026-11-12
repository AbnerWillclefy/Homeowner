# AlertCard

Something that needs attention now, in one card: a title, a message and at most one action.

- **When to use**: a bill due soon, a goal at risk, a connection that needs renewing. **When not**: the result of an action (use `Toast`), an error in one section (use `Banner`), or something destructive to confirm (use `Dialog`).
- **Tones**: `info`, `success`, `warning`, `danger`. Each has its own icon, and the title says what it is, so colour is never the only cue. `info` uses `text-muted` because there is no info colour.
- **Anatomy**: stacked icons (up to 3) of the items, a title with the count ("3 bills to pay"), a meta line with total and due date, a › arrow. An optional action as a `secondary` `sm` Button.
- **Urgency**: the meta turns `warning` when something is due within 3 days, `danger` when it is late.
- **Placement**: at most one AlertCard per screen, right below the hero card.
- **States**: on tap, a Sheet with the items and a primary Button ("Mark as paid"). After the action, the button turns `success`, each item gets a ✓, and the card shows the new state. When interactive: hover and pressed in `surface-hover`, and the `focus` ring. Data states follow the README.
- **Content**: advise, never command: "3 days left for the electricity bill", not "Pay now".
- **Accessibility**: `role="alert"` for `danger`, `role="status"` for the other tones, on the text and not around the action. The icons are `aria-hidden`. A live region announces what is inserted after the page loads, so the app inserts the card and does not toggle its text.

The consumer provides the tone, the title, the message and the optional action. Implementation: a plain element on the tokens. The tappable "bills to pay" row composes `ListRow` and `Sheet`.
