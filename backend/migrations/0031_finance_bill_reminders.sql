-- The ledger of Bill reminders already sent, so the hourly finance job sends
-- each Bill at most one reminder per month and kind. Expand only: one new
-- table, nothing existing changes.
--
-- A row is a claim made BEFORE the send (INSERT ... ON CONFLICT DO NOTHING, send
-- only for rows actually inserted), like nudges: delivery is at-most-once, and a
-- failed send is not retried. outcome is delivered, failed or gone (every device
-- answered gone, and they are pruned); NULL is a crash or a dropped send.
--
-- kind is due_soon (due today or tomorrow) or overdue (due earlier this month).
-- month is the first day of the month in the User's zone. sent_at comes from
-- the injected clock.

-- +goose Up
CREATE TABLE finance_bill_reminders (
    user_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    bill_id uuid        NOT NULL REFERENCES finance_bills (id) ON DELETE CASCADE,
    month   date        NOT NULL,
    kind    text        NOT NULL CHECK (kind IN ('due_soon', 'overdue')),
    sent_at timestamptz NOT NULL,
    outcome text,
    PRIMARY KEY (bill_id, month, kind)
);
CREATE INDEX finance_bill_reminders_user_idx ON finance_bill_reminders (user_id);

-- +goose Down
DROP TABLE finance_bill_reminders;
