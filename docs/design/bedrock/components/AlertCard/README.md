# AlertCard

Something that needs attention now, in one card: a title, a message and at most one action.

- **When to use**: a bill due soon, a goal at risk, a connection that needs renewing. **When not**: the result of an action (use `Toast`), an error in one section (use `Banner`), or something destructive to confirm (use `Dialog`).
- **Tones**: `info`, `success`, `warning`, `danger`. Each has its own icon, and the title says what it is, so colour is never the only cue. `info` uses `text-muted` because there is no info colour.
- **Anatomy**: the tone icon, a title, a message and an optional action as a `secondary` `sm` Button. The card itself is not tappable, so the action never nests inside another interactive element.
- **Bills to pay row**: a composed row, not part of AlertCard: `ListRow` with up to 3 stacked item icons, a count title ("3 bills to pay"), a meta line with total and due date (`warning` within 3 days, `danger` when late) and a › arrow, opening a `Sheet` on tap.
- **Placement**: at most one AlertCard per screen, right below the hero card.
- **States**: after the action, its button turns `success` and the card shows the new state. Data states follow the README.
- **Content**: advise, never command: "3 days left for the electricity bill", not "Pay now".
- **Accessibility**: `role="alert"` for `danger`, `role="status"` for the other tones, on the text and not around the action. The icons are `aria-hidden`. A live region announces what is inserted after the page loads, so the app inserts the card and does not toggle its text.

The consumer provides the tone, the title, the message and the optional action. Implementation: a plain element on the tokens.