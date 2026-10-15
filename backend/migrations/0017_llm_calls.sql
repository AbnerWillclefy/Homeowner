-- The per-Home daily count of LLM allocator calls, the cap that bounds what
-- the model costs (ADR 0004). Expand only: one new table.
--
-- A slot is reserved BEFORE the call, outside the planning transaction, so a
-- call that fails, times out or whose plan is rolled back still counts: it was
-- paid for. Counting allocation_runs would miss those, since a rolled-back
-- planning writes no run. call_date is the Home's local date, like plan_date.

-- +goose Up
CREATE TABLE llm_calls (
    home_id   uuid    NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    call_date date    NOT NULL,
    calls     integer NOT NULL,
    PRIMARY KEY (home_id, call_date)
);

-- +goose Down
DROP TABLE llm_calls;
