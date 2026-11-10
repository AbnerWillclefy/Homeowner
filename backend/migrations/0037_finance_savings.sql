-- Savings: the Emergency reserve target and the Monthly contribution live on
-- the User's finance settings; Investments and Goals get their own tables
-- (filled by later tickets). Expand only: three nullable columns and two new
-- tables. Goal positions are unique per User but deferred, so a reorder can
-- rewrite them inside one transaction.

-- +goose Up
ALTER TABLE finance_settings
    ADD COLUMN reserve_target_cents    bigint   NULL CHECK (reserve_target_cents > 0),
    ADD COLUMN contribution_base_cents bigint   NULL CHECK (contribution_base_cents > 0),
    ADD COLUMN reserve_share_percent   smallint NULL CHECK (reserve_share_percent BETWEEN 0 AND 100),
    ADD CONSTRAINT finance_settings_contribution_pair
        CHECK ((contribution_base_cents IS NULL) = (reserve_share_percent IS NULL));

CREATE TABLE finance_investments (
    id          uuid        PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text        NOT NULL,
    value_cents bigint      NOT NULL CHECK (value_cents >= 0),
    serves      text        NOT NULL CHECK (serves IN ('reserve', 'goals')),
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL
);
CREATE INDEX finance_investments_user_idx ON finance_investments (user_id);

CREATE TABLE finance_goals (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    target_cents bigint      NOT NULL CHECK (target_cents > 0),
    position     int         NOT NULL,
    target_month date        NULL CHECK (target_month = date_trunc('month', target_month)::date),
    created_at   timestamptz NOT NULL,
    updated_at   timestamptz NOT NULL,
    UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- +goose Down
DROP TABLE finance_goals;
DROP TABLE finance_investments;
ALTER TABLE finance_settings
    DROP CONSTRAINT finance_settings_contribution_pair,
    DROP COLUMN reserve_share_percent,
    DROP COLUMN contribution_base_cents,
    DROP COLUMN reserve_target_cents;
