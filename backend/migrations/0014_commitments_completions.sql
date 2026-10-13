-- Commitments and Completions. Expand only: three new tables, nothing existing
-- changes.
--
-- task_residents is a Resident's Commitment to a Task on one local day (the
-- Task is Committed that day). committed_on is the date in the Home's zone, so
-- yesterday's Commitment is simply not read today. Rows are history for the
-- Streak (ADR 0003) and are never deleted. The primary key lets a second
-- accept the same day do nothing.
--
-- completions is the one Completion of a Task; completion_residents says who
-- did it. They are two tables so a two-person Task can have a second Resident
-- with no schema change. completed_on is the Home's local date.
--
-- A refusal has no table: it lives in the run's reasons.pool. Deleting a Task
-- (its Chore) or a Resident cascades, as for checkins.

-- +goose Up
CREATE TABLE task_residents (
    task_id      uuid        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    resident_id  uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    committed_on date        NOT NULL,
    committed_at timestamptz NOT NULL,
    PRIMARY KEY (task_id, resident_id, committed_on)
);

CREATE INDEX task_residents_resident_id_idx ON task_residents (resident_id);

CREATE TABLE completions (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      uuid        NOT NULL UNIQUE REFERENCES tasks (id) ON DELETE CASCADE,
    completed_at timestamptz NOT NULL,
    completed_on date        NOT NULL
);

CREATE TABLE completion_residents (
    completion_id uuid NOT NULL REFERENCES completions (id) ON DELETE CASCADE,
    resident_id   uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    PRIMARY KEY (completion_id, resident_id)
);

CREATE INDEX completion_residents_resident_id_idx ON completion_residents (resident_id);

-- +goose Down
DROP INDEX completion_residents_resident_id_idx;
DROP TABLE completion_residents;
DROP TABLE completions;
DROP INDEX task_residents_resident_id_idx;
DROP TABLE task_residents;
