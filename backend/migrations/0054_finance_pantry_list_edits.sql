-- Pantry list edits: the User's changes to the next shopping list, kept until
-- the item is next bought (a matched receipt line deletes its item's edit).
-- Expand only: one new table.

-- +goose Up
CREATE TABLE finance_pantry_list_edits (
    user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_id        uuid        NOT NULL REFERENCES finance_pantry_items (id) ON DELETE CASCADE,
    quantity_milli bigint      NULL CHECK (quantity_milli > 0),
    removed        boolean     NOT NULL DEFAULT false,
    updated_at     timestamptz NOT NULL,
    PRIMARY KEY (user_id, item_id)
);

-- +goose Down
DROP TABLE finance_pantry_list_edits;
