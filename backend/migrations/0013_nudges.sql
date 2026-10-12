-- The ledger of push nudges already sent, so the 15-minute Allocation tick does
-- not send the same Check-in reminder four times in an hour. Expand only: one
-- new table, nothing existing changes.
--
-- A row is a claim made BEFORE the send (INSERT ... ON CONFLICT DO NOTHING, send
-- only for rows actually inserted), so delivery is at-most-once. That matches
-- "push is a best-effort nudge" (ADR 0005): a crash between the claim and the
-- send loses one nudge instead of risking a duplicate. A failed send does not
-- remove the row: retrying a dead push service every 15 minutes is the
-- behaviour to avoid, and the app still asks for the Check-in when it opens.
--
-- Keyed by Resident, like checkins, and gone when they leave the Home.
-- local_date is the date in the Home's zone, never the UTC one. sent_at comes
-- from the injected clock, not now() in SQL.

-- +goose Up
CREATE TABLE nudges (
    resident_id uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    kind        text        NOT NULL CHECK (kind IN ('checkin_reminder', 'day_plan_ready')),
    local_date  date        NOT NULL,
    sent_at     timestamptz NOT NULL,
    PRIMARY KEY (resident_id, kind, local_date)
);

-- +goose Down
DROP TABLE nudges;
