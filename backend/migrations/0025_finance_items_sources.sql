-- The Pluggy Items a User connected and the accounts (Sources) read from them.
-- Expand only: two new tables, nothing existing is touched.
--
-- Every finance table carries user_id with ON DELETE CASCADE, even where a
-- parent implies it, so isolation is a plain WHERE user_id = $1 and a Home
-- is never referenced: Finances belong to the User alone.

-- +goose Up
CREATE TABLE finance_items (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pluggy_item_id  text        NOT NULL,
    connected_at    timestamptz NOT NULL,
    last_synced_at  timestamptz,
    import_complete boolean     NOT NULL DEFAULT false,
    UNIQUE (user_id, pluggy_item_id)
);

CREATE TABLE finance_sources (
    id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_id           uuid    NOT NULL REFERENCES finance_items (id) ON DELETE CASCADE,
    pluggy_account_id text    NOT NULL,
    kind              text    NOT NULL CHECK (kind IN ('checking', 'savings', 'credit_card')),
    name              text    NOT NULL,
    currency          char(3) NOT NULL,
    UNIQUE (item_id, pluggy_account_id)
);

-- +goose Down
DROP TABLE finance_sources;
DROP TABLE finance_items;
