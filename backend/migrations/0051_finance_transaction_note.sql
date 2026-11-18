-- A Note the User writes on a Transaction (a card charge that reads only "AMAZON").
-- The sync never writes it. "No Note" is NULL, never '' (the CHECK refuses an empty one).
-- Expand only: one nullable column. No index: the Revenue search runs in the browser.

-- +goose Up
ALTER TABLE finance_transactions ADD COLUMN note text NULL CHECK (char_length(note) BETWEEN 1 AND 200);

-- +goose Down
ALTER TABLE finance_transactions DROP COLUMN note;
