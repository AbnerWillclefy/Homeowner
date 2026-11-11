# 0021: A closed card bill takes the bank's total; the app computes only the open bill

The app worked out every card bill from Transactions and typed bill days. Real bills differed from the banks' by hundreds of reais: closing days move, and fees, IOF and carried balances are not Transactions. Pluggy sends each card's bills with closing date, due date and total ([ADR 0019](0019-take-bank-data-from-pluggy-with-per-user-credentials-encrypted-by-the-app.md)).

## Decision

- A bill Pluggy reports as closed takes its `totalAmount`.
- The open bill is the charges posted since the last reported closing plus known installments.
- A card with no reported bill keeps the computed rule.
- Bills are stored in `finance_card_bills` by the sync.

## Alternatives rejected

- **Keep computing and add fees:** still drifts when a closing day moves.
- **Trust only Pluggy:** there would be no open bill, and cards without bills would break.

## Consequences

- Resumo matches the bank, but a closed bill's Spending Categories may not sum to its total; the difference is not shown as a category.
- A bank that stops sending bills silently falls back to the computed rule.
- Bill payments can now be recognised by amount against a stored bill.
