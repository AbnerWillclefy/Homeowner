# Toast

A short confirmation of something that just happened, with undo when possible.

- Appears bottom right on desktop, bottom centre on phones, above the bottom bar. Disappears after 5s; stays while the pointer is over it.
- One past-tense sentence ("Category changed to Groceries") + "Undo" when the action is reversible. That is how the app avoids asking for confirmation.
- Error: a `danger` icon and what to do ("Couldn't connect to Nubank. Try again").

Implementation: shadcn/ui `Sonner`.
