-- A Transaction can be money put aside: a new type, `saving`, with no Spending
-- Category (the existing CHECK on type and spending_category already forces it).

-- +goose Up
ALTER TABLE finance_transactions DROP CONSTRAINT finance_transactions_type_check;
ALTER TABLE finance_transactions ADD CONSTRAINT finance_transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer', 'saving'));

-- +goose Down
-- A Transfer also has no category, so the row stays valid.
UPDATE finance_transactions SET type = 'transfer' WHERE type = 'saving';
ALTER TABLE finance_transactions DROP CONSTRAINT finance_transactions_type_check;
ALTER TABLE finance_transactions ADD CONSTRAINT finance_transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer'));
