-- The Day Plan of a Home for one local date, and the record of each Allocation
-- run. Expand only: two new tables, nothing existing changes.
--
-- plan_date is the date in the Home's zone when the run happened.
-- UNIQUE (home_id, plan_date) is the last-line guard for "once per day": the
-- planner locks the Home first, and a conflict here still means "already
-- planned". A rejected run (the checker refused the allocator's proposal) takes
-- the day too, so it is not retried until tomorrow.
--
-- reasons holds what cannot be recomputed later because Energy and Restrictions
-- change: per-Task assignment reasons, the pool entries with their reasons, the
-- Energy each Resident had, and the checker's violations for a rejected run.
-- Reasons are stable ids, localised by the PWA.
--
-- day_plan_assignments is not task_residents: Committed is a later ticket's
-- table. Deleting a Chore (its Tasks) or a Resident cascades.

-- +goose Up
CREATE TABLE allocation_runs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id         uuid        NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    plan_date       date        NOT NULL,
    allocator       text        NOT NULL,
    outcome         text        NOT NULL CHECK (outcome IN ('planned', 'rejected')),
    fallback_reason text,
    reasons         jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL,
    UNIQUE (home_id, plan_date)
);

CREATE TABLE day_plan_assignments (
    run_id      uuid NOT NULL REFERENCES allocation_runs (id) ON DELETE CASCADE,
    task_id     uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    reason      text NOT NULL,
    PRIMARY KEY (run_id, task_id)
);

CREATE INDEX day_plan_assignments_task_id_idx ON day_plan_assignments (task_id);
CREATE INDEX day_plan_assignments_resident_id_idx ON day_plan_assignments (resident_id);

-- +goose Down
DROP INDEX day_plan_assignments_resident_id_idx;
DROP INDEX day_plan_assignments_task_id_idx;
DROP TABLE day_plan_assignments;
DROP TABLE allocation_runs;
