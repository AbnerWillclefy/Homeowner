-- A Chore's Tasks. Expand only: a new table, nothing existing changes.
-- window_start and window_end are inclusive calendar dates in the Home's zone.
-- The partial unique index is the guarantee that a Chore has at most one open
-- Task, whatever the code does. A done Task frees the slot, so a one-off Chore
-- gets only one Task by the code locking its row (see internal/tasks).

-- +goose Up
CREATE TABLE tasks (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    chore_id       uuid        NOT NULL REFERENCES chores (id) ON DELETE CASCADE,
    status         text        NOT NULL CHECK (status IN ('open', 'done')),
    window_start   date        NOT NULL,
    window_end     date        NOT NULL CHECK (window_end >= window_start),
    current_effort smallint    NOT NULL CHECK (current_effort BETWEEN 1 AND 5),
    created_at     timestamptz NOT NULL,
    closed_on      date,
    CHECK ((status = 'done') = (closed_on IS NOT NULL))
);

CREATE UNIQUE INDEX tasks_one_open_per_chore_idx ON tasks (chore_id) WHERE status = 'open';
CREATE INDEX tasks_chore_id_window_start_idx ON tasks (chore_id, window_start);

-- +goose Down
DROP INDEX tasks_chore_id_window_start_idx;
DROP INDEX tasks_one_open_per_chore_idx;
DROP TABLE tasks;
