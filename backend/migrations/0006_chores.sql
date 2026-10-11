-- A Home's Chores. Expand only: a new table, nothing existing changes.
-- interval_days NULL means one-off (see CONTEXT.md). allowed_weekdays uses
-- 0 = Sunday to 6 = Saturday; empty means any day. Category, Demand and
-- Importance ids are validated in Go, so the lists can grow without a migration;
-- only numeric ranges that never change are CHECKs.

-- +goose Up
CREATE TABLE chores (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id          uuid        NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    name             text        NOT NULL,
    category         text        NOT NULL,
    demands          text[]      NOT NULL DEFAULT '{}',
    base_effort      smallint    NOT NULL CHECK (base_effort BETWEEN 1 AND 5),
    importance       text        NOT NULL,
    people           smallint    NOT NULL CHECK (people IN (1, 2)),
    interval_days    integer     CHECK (interval_days >= 1),
    allowed_weekdays smallint[]  NOT NULL DEFAULT '{}' CHECK (allowed_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
    builds_up        boolean     NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NOT NULL
);

CREATE INDEX chores_home_id_idx ON chores (home_id);

-- +goose Down
DROP INDEX chores_home_id_idx;
DROP TABLE chores;
