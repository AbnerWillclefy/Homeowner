-- A Bill suggestion the Resident dismissed, by merchant key, so it is not offered
-- again. Expand only: one new table.

-- +goose Up
CREATE TABLE finance_bill_suggestion_dismissals (
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    merchant_key text        NOT NULL,
    dismissed_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, merchant_key)
);

-- +goose Down
DROP TABLE finance_bill_suggestion_dismissals;
