-- An Investment can come from the bank. A Pluggy row has no pick yet, so serves
-- becomes nullable; hand-typed rows keep a pick through the check below. All
-- the columns the bank-sourced Investments need are added now, while no Pluggy
-- row exists, so value_set_by is right from the first one. Expand only:
-- nullable or defaulted columns, and the DROP NOT NULL only relaxes a constraint.

-- +goose Up
ALTER TABLE finance_investments
    ADD COLUMN item_id              uuid    NULL REFERENCES finance_items (id) ON DELETE CASCADE,
    ADD COLUMN pluggy_investment_id text    NULL,
    ADD COLUMN bank_value_cents     bigint  NULL,
    ADD COLUMN value_set_by         text    NOT NULL DEFAULT 'user' CHECK (value_set_by IN ('user', 'bank')),
    ADD COLUMN bank_reported        boolean NULL,
    ADD CONSTRAINT finance_investments_pluggy_key UNIQUE (item_id, pluggy_investment_id),
    ADD CONSTRAINT finance_investments_pluggy_pair CHECK ((item_id IS NULL) = (pluggy_investment_id IS NULL)),
    ADD CONSTRAINT finance_investments_pick CHECK (pluggy_investment_id IS NOT NULL OR serves IS NOT NULL);

ALTER TABLE finance_investments ALTER COLUMN serves DROP NOT NULL;

-- +goose Down
-- Not reversible once a Pluggy row exists: it has no pick to restore NOT NULL on.
DELETE FROM finance_investments WHERE pluggy_investment_id IS NOT NULL;
ALTER TABLE finance_investments ALTER COLUMN serves SET NOT NULL;
ALTER TABLE finance_investments
    DROP CONSTRAINT finance_investments_pick,
    DROP CONSTRAINT finance_investments_pluggy_pair,
    DROP CONSTRAINT finance_investments_pluggy_key,
    DROP COLUMN bank_reported,
    DROP COLUMN value_set_by,
    DROP COLUMN bank_value_cents,
    DROP COLUMN pluggy_investment_id,
    DROP COLUMN item_id;
