-- A Transaction whose other side is the User (a Pix or TED to oneself) is a
-- Transfer. Only that boolean is kept, never the other side's name or document.
-- The import restarts so the sync re-reads 12 months and sets it; the upsert
-- keeps every row's id and classify leaves rows the User typed alone.

-- +goose Up
ALTER TABLE finance_transactions ADD COLUMN own_counterpart boolean NOT NULL DEFAULT false;
UPDATE finance_sources SET import_cursor = NULL;
UPDATE finance_items SET import_complete = false;

-- +goose Down
ALTER TABLE finance_transactions DROP COLUMN own_counterpart;
