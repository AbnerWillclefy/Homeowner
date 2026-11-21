# Banner

A message that stays on screen until its cause goes away: a section that failed to load, or the app being offline.

- **When to use**: an error that belongs to one card or section, or a state of the whole screen (offline, stale data). **When not**: the result of an action (use `Toast`), a field error (use `Input`'s error), or something destructive to confirm (use `Dialog`).
- **Tones**: `danger` (something failed: "Couldn't load your goals"), `warning` (degraded: "No connection. Showing data from 10:42"), `neutral` (information). The background is the tone's `-soft` (`surface-hover` for neutral), the icon is in the tone's colour, the text is `text`.
- **Anatomy**: a 16px icon, one or two sentences, and at most one action on the right ("Try again"), as a `ghost` `sm` Button.
- **Placement**: a section error goes inside the card it belongs to, in place of the content that failed. A screen-wide banner sits at the top of the content area, below the page title.
- **States**: the action can be `loading` while it retries. The banner disappears when its cause is gone; it has no close button when the cause is still there.
- **Content**: what happened and how to fix it, without apologising.
- **Accessibility**: `role="status"` for `warning` and `neutral`, `role="alert"` for `danger`, so it is announced when it appears. The icon is `aria-hidden`; the tone is in the words.

The consumer provides the tone, the text and the optional action. Implementation: a plain element on the tokens, no Radix primitive needed.
