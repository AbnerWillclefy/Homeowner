# Undoable Task and Chore actions are sent when their Toast closes

Bedrock's rule of easy reversal ([ADR 0022](0022-a-shared-bedrock-design-system-amends-0007-and-0009-for-adopting-apps.md), `docs/design/bedrock/`) asks that a reversible action happen at once, with Desfazer in a Toast and no confirmation dialog. Most of the PWA's changes can be undone by writing the old value back: settings, a Completion's time, Preferences, Restrictions and Responsible all have routes for that. Three cannot. Recusar sends the Task back to the pool (`dayplan.Refuse`), Concluir records a Completion that no route removes, and deleting a Chore is final. `Take` is not an inverse of Refuse: it commits the Task, and it refuses two-person Tasks. The PWA's move to Bedrock (#882) keeps the API unchanged, and Bedrock's `Toast` with an action never times out, a deliberate WCAG 2.2.1 choice, so the Toast alone cannot decide when the action becomes real.

## Decision

- **Recusar, Concluir and deleting a Chore, tapped on the screen, are held in the client.** The PWA shows the action as done at once and holds its request. The screen shows the pending action over the cached data until it is sent; this ADR does not fix the mechanism (drawing the pending action over the cache at render time, or writing it into the cache and cancelling refetches), only that a refetch must not undo it on screen.
- **The held request is sent** when any of these comes first:
  - its Toast closes for any reason other than Desfazer (the close button, a swipe, Escape);
  - another undoable action starts;
  - the Resident navigates to another tab;
  - the page becomes hidden (`visibilitychange` to `hidden`).
- **Desfazer drops the request and restores the cache**, so the screen shows the data as it was.
- **One pending write at a time.** Starting a second undoable action sends the first.
- **A failed send restores the cache** and shows the usual error Toast.
- **Changes undone by writing the old value back are sent at once**, and their Desfazer writes the old value. Only the three actions above are held.
- **Voice is out of the hold.** Recusar and Concluir through a voice command (`web/src/domains/voice/logic/apply.ts`) already pass a confirmation ([ADR 0020](0020-voice-commands-send-chore-titles-and-the-residents-words-behind-a-confirmation.md)), and the voice panel reports each result, so they are sent at once. The hold applies to taps only.

**Navigating to another tab sends the held write.** This is a product choice added to the hold. Because the Toast with an action never times out, a Concluir held only until the Toast closes could sit unsent, unseen by other Residents and outside the Streak, for as long as the Resident stays on one screen. Leaving the tab ends the moment in which Desfazer makes sense.

## Considered Options

- **Inverse routes** (`DELETE` a Completion, un-refuse, restore a Chore). Every write would reach the server at once. But it changes the API, un-refusing after another Resident has taken the Task has no clean meaning, and un-completing touches the Streak ([ADR 0003](0003-only-broken-commitments-break-a-streak.md), [ADR 0014](0014-a-day-with-any-completion-keeps-the-streak.md)).
- **A timed Toast** (for example 8 seconds, then send). Simple, but it conflicts with Bedrock's WCAG 2.2.1 rule that a Toast with an action does not time out.
- **Keep confirmation dialogs.** Nothing to hold, but it is the friction the move to Bedrock removes.

## Consequences

- **Consistency window.** Until the write is sent, other Residents and the Streak do not see the action. The longest window is a Resident who stays on one screen with the Toast open; a tab change, another undoable action or hiding the page ends it.
- **Loss window.** Closing the app without a `visibilitychange` (a crash, a killed process) loses the pending write. The send on page hide is best effort: the house adapter (`web/src/shared/api/fetchAdapter.ts`) passes `config.fetchOptions` to `fetch`, so it can be a `keepalive` request, which the browser finishes after the page goes. But `authedRequest` may first need to refresh the Cognito token, an async step that may not finish once the page is hidden, and a `keepalive` body is capped at 64 KB (these bodies are far below it).
- **The Toast must tell Desfazer from a dismissal.** Bedrock's `Toast` already gives both: the action's `onClick`, then `onOpenChange(false)` (`bedrock/src/components/toast.tsx`). The hook that holds the write handles that order.
- **One shared hook owns the hold** in `web/`, so every screen with these three actions behaves the same; its pure state is unit tested.
- **No API change.** If a later need makes inverse routes worth it, this ADR is superseded and the hold goes.
