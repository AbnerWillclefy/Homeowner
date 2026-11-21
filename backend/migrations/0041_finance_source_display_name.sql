-- A User can name a Source for display; a sync never writes this column, so the
-- bank's own name (`name`) can keep refreshing beside it.

-- +goose Up
ALTER TABLE finance_sources ADD COLUMN display_name text;

-- +goose Down
ALTER TABLE finance_sources DROP COLUMN display_name;
