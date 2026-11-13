-- Each bank account Source keeps the balance the bank reported, one row per day
-- of a sync; a day with no sync takes the last earlier balance when read.
-- Expand only: one new table with user_id and cascades. No sign check: an
-- overdraft is negative. History starts at the first sync after this ships.

-- +goose Up
CREATE TABLE finance_source_balances (
    user_id       uuid   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source_id     uuid   NOT NULL REFERENCES finance_sources (id) ON DELETE CASCADE,
    day           date   NOT NULL,
    balance_cents bigint NOT NULL,
    PRIMARY KEY (source_id, day)
);
CREATE INDEX finance_source_balances_user_idx ON finance_source_balances (user_id);

-- +goose Down
DROP TABLE finance_source_balances;
