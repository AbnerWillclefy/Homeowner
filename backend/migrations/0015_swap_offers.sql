-- Swap offers. Expand only: one new table, nothing existing changes.
--
-- A swap offer is one Resident's offer to exchange one of their Tasks
-- (offered) for another Resident's (requested) in the Day Plan of one local
-- day. It only happens when the other Resident accepts. plan_date is the
-- Home's local date, so yesterday's offers are simply not read today: there is
-- no expiry status and no cleanup job.
--
-- Status moves once, from pending to accepted, declined or cancelled, and
-- answered_at is set exactly then. An offer is live only while the offered
-- Task is still assigned to from_resident_id, the requested Task to
-- to_resident_id, and neither is done; that is decided when reading, not
-- stored. The partial unique index stops a double tap from making two live
-- offers for the same pair of Tasks on one day (Task ids come back every day).
--
-- An accepted swap moves both day_plan_assignments rows, deletes the two old
-- holders' task_residents rows for the day and inserts the new holders' (the
-- one exception to "never deleted" in 0014). This table is the record of it.
-- Deleting a Task (its Chore) or a Resident cascades.

-- +goose Up
CREATE TABLE swap_offers (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id           uuid        NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    plan_date         date        NOT NULL,
    offered_task_id   uuid        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    requested_task_id uuid        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    from_resident_id  uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    to_resident_id    uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    status            text        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at        timestamptz NOT NULL,
    answered_at       timestamptz,
    CHECK (offered_task_id <> requested_task_id),
    CHECK (from_resident_id <> to_resident_id),
    CHECK ((answered_at IS NULL) = (status = 'pending'))
);

CREATE INDEX swap_offers_home_id_plan_date_idx ON swap_offers (home_id, plan_date);

CREATE UNIQUE INDEX swap_offers_pending_pair_idx
    ON swap_offers (plan_date, offered_task_id, requested_task_id) WHERE status = 'pending';

-- +goose Down
DROP INDEX swap_offers_pending_pair_idx;
DROP INDEX swap_offers_home_id_plan_date_idx;
DROP TABLE swap_offers;
