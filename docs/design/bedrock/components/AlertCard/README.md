# AlertCard

Something that needs action now, in one row, opening a sheet with the list and the action.

- Stacked icons (up to 3) of the items, a title with the count ("3 bills to pay"), a meta line with total and due date, a › arrow.
- The meta turns `warning` when something is due within 3 days, `danger` when it is late.
- On tap: a Sheet with the items and a primary Button ("Mark as paid"). After the action, the button turns `success`, each item gets a ✓, and the card shows the new state.
- At most one AlertCard per screen, right below the hero card.
