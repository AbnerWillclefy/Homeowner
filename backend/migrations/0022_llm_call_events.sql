-- One row each time the Planner would ask the LLM, with how it went. Expand
-- only: one new table, nothing existing is touched.
--
-- A row means "the Planner would ask the model": accepted, rejected by the
-- referee, invalid, timed out, errored, or skipped because the daily cap or the
-- tick budget stopped it. "Nothing worth asking" is not an event.
--
-- It is best effort: written by one INSERT on the pool after the planning
-- transaction commits, so a crash between the two loses the row. llm_calls
-- stays the authoritative cap. The table holds ids, numbers and fixed
-- vocabulary only, never prompts, model output, names or titles.
--
-- home_id and run_id are SET NULL, not CASCADE, so the history of cost and
-- reliability outlives a deleted Home or a run that ReplanHome deletes.
-- The table grows by about 2 rows per Home per day; pruning is deferred.

-- +goose Up
CREATE TABLE llm_call_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL,
    local_date      date        NOT NULL,
    home_id         uuid        NULL REFERENCES homes (id) ON DELETE SET NULL,
    run_id          uuid        NULL REFERENCES allocation_runs (id) ON DELETE SET NULL,
    service         text        NOT NULL CHECK (service IN ('allocator', 'explainer')),
    model           text        NOT NULL,
    outcome         text        NOT NULL CHECK (outcome IN (
        'accepted', 'rejected_by_referee', 'invalid_response', 'timeout',
        'error', 'skipped_cap', 'skipped_budget')),
    violation_kinds text[]      NOT NULL DEFAULT '{}',
    latency_ms      integer     NULL,
    input_tokens    integer     NULL,
    output_tokens   integer     NULL,
    est_cost_micros bigint      NULL
);

CREATE INDEX llm_call_events_created_at_idx ON llm_call_events (created_at);
CREATE INDEX llm_call_events_service_date_idx ON llm_call_events (service, local_date);

-- +goose Down
DROP TABLE llm_call_events;
