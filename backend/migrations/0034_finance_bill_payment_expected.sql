-- The expected amount of a Bill when its month was paid, so editing the Bill
-- later does not rewrite history. NULL means paid before this column existed;
-- reads then use the Bill's current amount. Expand only: one nullable column.

-- +goose Up
ALTER TABLE finance_bill_payments ADD COLUMN expected_cents bigint CHECK (expected_cents > 0);

-- +goose Down
ALTER TABLE finance_bill_payments DROP COLUMN expected_cents;
