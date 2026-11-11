-- The bank's own card bills, kept by the sync (ADR 0021). A closed bill takes
-- the bank's total; one bill is told apart by Pluggy's id, so a sync updates it.

-- +goose Up
CREATE TABLE finance_card_bills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source_id   uuid NOT NULL REFERENCES finance_sources (id) ON DELETE CASCADE,
    provider_id text NOT NULL,
    closes_on   date NOT NULL,
    due_on      date NOT NULL,
    total_cents bigint NOT NULL,
    UNIQUE (source_id, provider_id)
);
CREATE INDEX finance_card_bills_user_due ON finance_card_bills (user_id, due_on);

-- +goose Down
DROP TABLE finance_card_bills;
