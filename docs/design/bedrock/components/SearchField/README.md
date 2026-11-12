# SearchField

Search with filters as tokens, for Transactions and long lists.

- **When to use**: finding records in a long list. **When not**: choosing one value from a short list (use `Select`) or entering data (use `Input`).
- **Anatomy**: free text searches description, bank and category. Applied filters become tokens inside the field (`amount: >1000`, `category: Groceries`) and chips below ("Status is Paid, Pending ×"). A filter button beside it, with the number of active filters in a `brand` badge. The first release is the text field with its clear button; the filters follow.
- **Look**: a rounded field with a search icon, in the `Input` look.
- **States**: the `focus` ring. The clear button shows only when there is text. Loading, empty and error follow Data states in the README: with no match, an `EmptyState` of the no-results kind.
- **Content**: always show the result: "**24** of 248 transactions" and "Clear all" on the right.
- **Accessibility**: a native search field with a label that screen readers hear. The clear button has its own label, and it returns focus to the field. `Esc` clears the text; `/` focuses the field on desktop.

The consumer provides the label, the clear label, the text, the active filters and the remove and clear callbacks. Implementation: a native `<input type="search">`; shadcn/ui `Command` (cmdk) for suggestions and `Popover` for the filter panel when the filters arrive.
