-- A Home and its Residents. Expand only: new tables, nothing existing changes.
-- allocation_time is the local wall-clock time in the Home's timezone (no
-- seconds); store the zone name, never a UTC instant, so daylight saving works.
-- UNIQUE (user_id) is the rule "a User is a Resident of at most one Home".

-- +goose Up
CREATE TABLE homes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    timezone        text        NOT NULL,
    allocation_time time        NOT NULL,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NOT NULL
);

CREATE TABLE residents (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    home_id    uuid        NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL
);

CREATE INDEX residents_home_id_idx ON residents (home_id);

-- +goose Down
DROP INDEX residents_home_id_idx;
DROP TABLE residents;
DROP TABLE homes;
