# Toast

A short confirmation of something that just happened, with undo when possible.

- Appears bottom right on desktop, bottom centre on phones, above the bottom bar. Disappears after 5s; stays while the pointer is over it.
- One past-tense sentence ("Category changed to Groceries") + "Undo" when the action is reversible. That is how the app avoids asking for confirmation.
- Error: a `danger` icon and what to do ("Couldn't connect to Nubank. Try again").
- A toast with an action, which includes every error, stays until the person acts on it or dismisses it. Only a toast without an action disappears after 5s.

Implementation: shadcn/ui `Sonner`.
