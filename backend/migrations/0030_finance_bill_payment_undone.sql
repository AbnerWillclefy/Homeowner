-- A bank payment the User undoes stays as a tombstone, so the matcher sees the
-- Bill-month as taken and never pays it automatically again. Expand only: one
-- nullable column.

-- +goose Up
ALTER TABLE finance_bill_payments ADD COLUMN undone_at timestamptz;

-- +goose Down
ALTER TABLE finance_bill_payments DROP COLUMN undone_at;
