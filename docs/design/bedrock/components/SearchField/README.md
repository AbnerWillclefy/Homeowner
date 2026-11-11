# SearchField

Search with filters as tokens, for Transactions and long lists.

- Free text searches description, bank and category. Applied filters become tokens inside the field (`amount: >1000`, `category: Groceries`) and chips below ("Status is Paid, Pending ×").
- A filter button beside it, with the number of active filters in a `brand` badge.
- Always show the result: "**24** of 248 transactions" and "Clear all" on the right.
- `Esc` clears the text; `/` focuses the field on desktop.

The consumer provides the text, the active filters and the remove and clear callbacks. Implementation: shadcn/ui `Command` (cmdk) for suggestions, `Popover` for the filter panel.
