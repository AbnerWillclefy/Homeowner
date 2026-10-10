-- Creates no tables by design: the first migration proves the pipeline works.
-- goose can reject a file without statements, hence the harmless SELECT.

-- +goose Up
SELECT 1;

-- +goose Down
SELECT 1;
