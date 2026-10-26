-- How many items a call asked about and how many the Planner kept, so a partial
-- acceptance of an explainer answer is visible. Expand only: two nullable
-- columns, nothing existing is touched.
--
-- items_sent is the number of Residents an explainer call asked about;
-- items_accepted the number of summaries kept after validation. Both are NULL
-- on allocator rows, and items_accepted is also NULL when no call was made
-- (skipped_cap, skipped_budget, or a failed reservation). Numbers only, never
-- text.

-- +goose Up
ALTER TABLE llm_call_events
    ADD COLUMN items_sent     integer NULL,
    ADD COLUMN items_accepted integer NULL;

-- +goose Down
ALTER TABLE llm_call_events
    DROP COLUMN items_accepted,
    DROP COLUMN items_sent;
