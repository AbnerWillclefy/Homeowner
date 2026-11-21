-- Pantry receipts: a grocery receipt, its lines, and the User's saved line
-- matches. Expand only: three new tables. A line's match to an item is also its
-- purchase of that item, dated by the receipt's issued_on. The consumer's CPF
-- has no column on purpose.

-- +goose Up
CREATE TABLE finance_pantry_receipts (
    id          uuid        PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_key  char(44)    NULL,
    store_name  text        NOT NULL,
    store_cnpj  char(14)    NULL,
    issued_on   date        NOT NULL,
    total_cents bigint      NOT NULL,
    read_by     text        NOT NULL CHECK (read_by IN ('sefaz', 'photo')),
    created_at  timestamptz NOT NULL,
    -- NULLs stay distinct: a photo receipt has no key.
    UNIQUE (user_id, access_key)
);

CREATE TABLE finance_pantry_receipt_lines (
    user_id          uuid   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    receipt_id       uuid   NOT NULL REFERENCES finance_pantry_receipts (id) ON DELETE CASCADE,
    line_no          int    NOT NULL,
    description      text   NOT NULL,
    product_code     text   NULL,
    quantity_milli   bigint NOT NULL CHECK (quantity_milli > 0),
    unit             text   NOT NULL,
    unit_price_cents bigint NOT NULL,
    total_cents      bigint NOT NULL,
    line_key         text   NOT NULL,
    -- Deleting an item keeps the receipt: its lines go back to unmatched.
    item_id          uuid   NULL REFERENCES finance_pantry_items (id) ON DELETE SET NULL,
    ignored          boolean NOT NULL DEFAULT false,
    CHECK (NOT ignored OR item_id IS NULL),
    PRIMARY KEY (receipt_id, line_no)
);
CREATE INDEX finance_pantry_receipt_lines_item_idx ON finance_pantry_receipt_lines (item_id);

CREATE TABLE finance_pantry_line_matches (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    line_key   text        NOT NULL,
    -- Deleting an item makes the next trip ask about its lines again.
    item_id    uuid        NULL REFERENCES finance_pantry_items (id) ON DELETE CASCADE,
    ignored    boolean     NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK ((item_id IS NOT NULL) <> ignored),
    PRIMARY KEY (user_id, line_key)
);

-- +goose Down
DROP TABLE finance_pantry_line_matches;
DROP TABLE finance_pantry_receipt_lines;
DROP TABLE finance_pantry_receipts;
