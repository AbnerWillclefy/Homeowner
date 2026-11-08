-- The User's Bills to pay and the months they are paid. Expand only: two new
-- tables. A Bill is a template (a name, an expected amount, a due day); a
-- payment row says one month of it is paid. Neither references a Home: the rows
-- go with the User.
--
-- paid_by and transaction_id are here now so the ticket that links a bank
-- Transaction needs no ALTER: a Transaction matches at most one payment (UNIQUE).
-- month is the first day of the month.

-- +goose Up
CREATE TABLE finance_bills (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name           text        NOT NULL,
    expected_cents bigint      NOT NULL CHECK (expected_cents > 0),
    due_day        smallint    NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    created_at     timestamptz NOT NULL,
    updated_at     timestamptz NOT NULL
);
CREATE INDEX finance_bills_user_idx ON finance_bills (user_id);

CREATE TABLE finance_bill_payments (
    bill_id        uuid        NOT NULL REFERENCES finance_bills (id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    month          date        NOT NULL,
    paid_by        text        NOT NULL CHECK (paid_by IN ('hand', 'bank')),
    transaction_id uuid        UNIQUE REFERENCES finance_transactions (id) ON DELETE SET NULL,
    paid_at        timestamptz NOT NULL,
    PRIMARY KEY (bill_id, month)
);

-- +goose Down
DROP TABLE finance_bill_payments;
DROP TABLE finance_bills;
