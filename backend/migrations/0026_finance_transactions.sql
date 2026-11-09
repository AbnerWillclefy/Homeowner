-- The Transactions imported from a User's Sources, and how far each Source is
-- imported. Expand only: one new table and one nullable column.
--
-- amount_cents is signed from the Source's point of view: negative is money
-- out. provider_id is Pluggy's own transaction id (its providerId is missing on
-- real rows), the de-duplication key. The categories and installment fields are
-- here now so the rules that fill them need no ALTER. category_set_by
-- 'fallback' means "Other, because nothing has decided yet". A Home is never
-- referenced: the rows go with the User.

-- +goose Up
ALTER TABLE finance_sources ADD COLUMN import_cursor date;

CREATE TABLE finance_transactions (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source_id          uuid        NOT NULL REFERENCES finance_sources (id) ON DELETE CASCADE,
    provider_id        text        NOT NULL,
    posted_on          date        NOT NULL,
    amount_cents       bigint      NOT NULL,
    currency           char(3)     NOT NULL CHECK (currency = 'BRL'),
    description        text        NOT NULL,
    merchant_key       text        NOT NULL,
    type               text        NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    type_set_by        text        NOT NULL CHECK (type_set_by IN ('auto', 'user')),
    spending_category  text        CHECK (spending_category IN ('housing', 'household_bills', 'groceries',
                           'eating_out', 'transport', 'health', 'education', 'leisure', 'shopping',
                           'subscriptions', 'pets', 'taxes_fees', 'other')),
    category_set_by    text        CHECK (category_set_by IN ('auto', 'user', 'fallback')),
    installment_number smallint,
    total_installments smallint,
    created_at         timestamptz NOT NULL,
    updated_at         timestamptz NOT NULL,
    UNIQUE (source_id, provider_id),
    CHECK ((type = 'expense') = (spending_category IS NOT NULL)),
    CHECK ((installment_number IS NULL AND total_installments IS NULL)
        OR (installment_number >= 1 AND installment_number <= total_installments))
);

CREATE INDEX finance_transactions_user_posted_on ON finance_transactions (user_id, posted_on);

-- +goose Down
DROP TABLE finance_transactions;
ALTER TABLE finance_sources DROP COLUMN import_cursor;
