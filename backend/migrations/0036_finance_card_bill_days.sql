-- The days of the month a card Source's bill closes and is due, read from
-- Pluggy, so a card charge counts in the month its bill is due. Expand only:
-- two nullable columns; null counts the charge on the day it posted.

-- +goose Up
ALTER TABLE finance_sources
    ADD COLUMN bill_close_day smallint CHECK (bill_close_day BETWEEN 1 AND 31),
    ADD COLUMN bill_due_day   smallint CHECK (bill_due_day BETWEEN 1 AND 31);

-- +goose Down
ALTER TABLE finance_sources DROP COLUMN bill_close_day, DROP COLUMN bill_due_day;
