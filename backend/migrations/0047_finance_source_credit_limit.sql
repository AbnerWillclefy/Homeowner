-- A card Source keeps the credit limit its bank reports, in cents (Pluggy's
-- creditData.creditLimit). Null when the connector gives none.
-- Expand only: one nullable column, no backfill; the next sync fills it.

-- +goose Up
ALTER TABLE finance_sources ADD COLUMN credit_limit_cents bigint CHECK (credit_limit_cents >= 0);

-- +goose Down
ALTER TABLE finance_sources DROP COLUMN credit_limit_cents;
