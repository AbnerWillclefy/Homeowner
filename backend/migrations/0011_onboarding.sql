-- Onboarding progress: the last step a User completed or skipped, or 'done'.
-- NULL means not started. Expand only: one nullable column, nothing existing
-- changes, so the previous release keeps working while this migration is live.
--
-- No CHECK on the values: the ordered step list lives in Go
-- (internal/onboarding) and is validated there, like vocab.
--
-- Every existing User is backfilled to 'done' so nobody who already uses the
-- app is pushed into onboarding.

-- +goose Up
ALTER TABLE users ADD COLUMN onboarding_step text NULL;
UPDATE users SET onboarding_step = 'done';

-- +goose Down
ALTER TABLE users DROP COLUMN onboarding_step;
