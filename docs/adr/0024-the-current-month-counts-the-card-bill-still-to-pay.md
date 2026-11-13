# 0024: The current month counts the card bill still to pay

[ADR 0021](0021-a-closed-card-bill-takes-the-banks-total.md) gave each month the card bill *due* in it. The Resident pays three cards with different closing and due days and needs the bill still to pay: a card due on the 1st or the 5th put its open bill in the next month, so Resumo showed 43.75 for a Santander bill of 117.83.

## Decision

In the month today is in, each card counts:

- its latest closed bill (the bank's total) until it is paid or past its due day;
- then its open bill: the charges posted on or after that closing, plus installments still to be charged.

A bill is paid when a debit off the cards of exactly its total posts between its closing and three days past its due day. A card without bank bills, or whose typed closing is a week past the bank's latest, uses its typed days; a closed bill from typed days has no total to match, so only its due day ends it. Later months leave out the charges the current month's bill holds. Every other month keeps ADR 0021.

## Alternatives rejected

- **Count the closed and the open bill together until the closed one is paid:** shows more than the next payment.
- **Count only the open bill:** hides a closed bill still to leave the account.

## Consequences

- Between a closing and the payment, charges after the closing count in no bill until the payment matches.
- Net worth always subtracts the current month's bill.
