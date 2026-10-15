-- The LLM-written explanation of a Resident's Day Plan, in both languages the
-- PWA ships (the backend does not know a Resident's locale yet, ADR 0006).
-- Expand only: one new table.
--
-- Only accepted LLM text is stored. The templated explanation is computed
-- from the plan's reasons when the Day Plan is read, so a Resident always has
-- one and nothing needs storing for it. The fingerprint is a hash of the
-- Resident's assignments and Energy when the text was written: when the plan
-- changes (a Check-in, Refuse, Take, Swap) it no longer matches and the text
-- is not shown. Both rows go with their run or Resident.

-- +goose Up
CREATE TABLE day_plan_explanations (
    run_id      uuid        NOT NULL REFERENCES allocation_runs (id) ON DELETE CASCADE,
    resident_id uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    text_en     text        NOT NULL,
    text_pt     text        NOT NULL,
    fingerprint text        NOT NULL,
    created_at  timestamptz NOT NULL,
    PRIMARY KEY (run_id, resident_id)
);

-- +goose Down
DROP TABLE day_plan_explanations;
