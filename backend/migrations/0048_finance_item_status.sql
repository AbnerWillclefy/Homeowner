-- What Pluggy last said about each connected Item: its status (and the
-- executionStatus an OUTDATED one needs) and the
-- institution's name. Expand only, both nullable: existing rows fill on the
-- next sync, and null reads as "ok" with no bank name.

-- +goose Up
ALTER TABLE finance_items ADD COLUMN status text, ADD COLUMN execution_status text, ADD COLUMN connector_name text;

-- +goose Down
ALTER TABLE finance_items DROP COLUMN status, DROP COLUMN execution_status, DROP COLUMN connector_name;
