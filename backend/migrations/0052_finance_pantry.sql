-- Pantry: the User's private list of generic items and the days each ran out.
-- Expand only: two new tables. An item's state is derived from its run-outs
-- (and, from a later ticket, its purchases), never stored. Names are unique per
-- User ignoring case, so receipt matching cannot create a second "Café".

-- +goose Up
CREATE TABLE finance_pantry_items (
    id              uuid        PRIMARY KEY,
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            text        NOT NULL,
    preferred_brand text        NULL,
    fixed           boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NOT NULL
);
CREATE UNIQUE INDEX finance_pantry_items_name_idx ON finance_pantry_items (user_id, lower(name));

CREATE TABLE finance_pantry_run_outs (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_id    uuid        NOT NULL REFERENCES finance_pantry_items (id) ON DELETE CASCADE,
    ran_out_on date        NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE INDEX finance_pantry_run_outs_item_idx ON finance_pantry_run_outs (item_id, ran_out_on);

-- +goose Down
DROP TABLE finance_pantry_run_outs;
DROP TABLE finance_pantry_items;
