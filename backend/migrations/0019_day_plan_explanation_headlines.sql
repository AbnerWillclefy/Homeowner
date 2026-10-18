-- The LLM-written explanation of a Resident's Day Plan becomes a headline and a
-- detail. Expand only: two new nullable columns, no default, no backfill.
--
-- headline_en and headline_pt hold the headline in each language. text_en and
-- text_pt, which 0018 created for the whole text, now hold the DETAIL. A row
-- written before this migration has no headline (both columns NULL); the code
-- treats it as absent, so that day shows the templated summary and nothing is
-- rewritten. The old binary's INSERT names its columns and its SELECT reads
-- only text_* and fingerprint, so this is safe to deploy before the new code.
--
-- A row has both headlines or neither.

-- +goose Up
ALTER TABLE day_plan_explanations
    ADD COLUMN headline_en text,
    ADD COLUMN headline_pt text,
    ADD CONSTRAINT day_plan_explanations_headlines_together
        CHECK ((headline_en IS NULL) = (headline_pt IS NULL));

-- +goose Down
ALTER TABLE day_plan_explanations
    DROP CONSTRAINT day_plan_explanations_headlines_together,
    DROP COLUMN headline_pt,
    DROP COLUMN headline_en;
