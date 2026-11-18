-- A credit card the User keeps by hand (a partner's card the bank cannot connect):
-- a name, a due day, one typed bill total per month, and optionally the name of the
-- Pix recipient that pays its bill (a Pix to that name is a Transfer on sync, like
-- 0042's own-counterpart rule). The recipient is a name the User types, deleted with
-- the card and with DELETE /me/finance. Expand only: two new tables, each with a
-- user_id cascade. A month with no row is "not typed", distinct from a typed 0.

-- +goose Up
CREATE TABLE finance_manual_cards (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          text        NOT NULL,
    due_day       smallint    NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    pix_recipient text        NULL,
    created_at    timestamptz NOT NULL,
    updated_at    timestamptz NOT NULL
);
CREATE INDEX finance_manual_cards_user_idx ON finance_manual_cards (user_id);

CREATE TABLE finance_manual_card_bills (
    card_id     uuid   NOT NULL REFERENCES finance_manual_cards (id) ON DELETE CASCADE,
    user_id     uuid   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    month       date   NOT NULL CHECK (month = date_trunc('month', month)::date),
    total_cents bigint NOT NULL CHECK (total_cents >= 0),
    PRIMARY KEY (card_id, month)
);
CREATE INDEX finance_manual_card_bills_user_idx ON finance_manual_card_bills (user_id);

-- +goose Down
DROP TABLE finance_manual_card_bills;
DROP TABLE finance_manual_cards;
