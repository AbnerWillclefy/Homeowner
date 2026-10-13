-- Two-person Tasks. Expand-compatible: a key is loosened, nothing is dropped
-- and no data changes.
--
-- A two-person Task is given to two Residents, one day_plan_assignments row
-- each, so the key moves from (run_id, task_id) to (run_id, task_id,
-- resident_id). One-person Tasks still have one row; that is kept by the
-- Allocation checker, not by the key. task_residents and completion_residents
-- already hold one row per Resident.

-- +goose Up
ALTER TABLE day_plan_assignments DROP CONSTRAINT day_plan_assignments_pkey;
ALTER TABLE day_plan_assignments ADD PRIMARY KEY (run_id, task_id, resident_id);

-- +goose Down
-- Fails when a run holds two rows for one Task (a two-person Task was planned):
-- delete those rows first.
ALTER TABLE day_plan_assignments DROP CONSTRAINT day_plan_assignments_pkey;
ALTER TABLE day_plan_assignments ADD PRIMARY KEY (run_id, task_id);
