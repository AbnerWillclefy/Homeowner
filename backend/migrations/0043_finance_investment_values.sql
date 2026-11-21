-- Each Investment keeps one value per day it was written; a day with no write
-- takes the last earlier value when read. Expand only: one new table. Like every
-- finance table it carries user_id with a cascade. The existing Investments are
-- seeded with today's (São Paulo) value, so their history starts now.

-- +goose Up
CREATE TABLE finance_investment_values (
    user_id       uuid   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    investment_id uuid   NOT NULL REFERENCES finance_investments (id) ON DELETE CASCADE,
    day           date   NOT NULL,
    value_cents   bigint NOT NULL CHECK (value_cents >= 0),
    PRIMARY KEY (investment_id, day)
);
CREATE INDEX finance_investment_values_user_idx ON finance_investment_values (user_id);

INSERT INTO finance_investment_values (investment_id, user_id, day, value_cents)
SELECT id, user_id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, value_cents FROM finance_investments;

-- +goose Down
DROP TABLE finance_investment_values;
