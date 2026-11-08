-- The User's monthly limit for a Spending Category. One row per User and
-- category; no row means "no limit". The limit holds for every month, so there
-- is no month column and no history. Expand only: one new table. The primary
-- key serves the per-User read.

-- +goose Up
CREATE TABLE finance_category_budgets (
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    spending_category text        NOT NULL,
    limit_cents       bigint      NOT NULL CHECK (limit_cents > 0),
    updated_at        timestamptz NOT NULL,
    PRIMARY KEY (user_id, spending_category)
);

-- +goose Down
DROP TABLE finance_category_budgets;
