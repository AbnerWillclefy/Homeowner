-- The User's Finances settings: today only the Monthly income, which the
-- commitments view divides by. Expand only: one new table. NULL means "not
-- set"; the row goes with the User.

-- +goose Up
CREATE TABLE finance_settings (
    user_id              uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    monthly_income_cents bigint      NULL CHECK (monthly_income_cents > 0),
    updated_at           timestamptz NOT NULL
);

-- +goose Down
DROP TABLE finance_settings;
