-- +goose Up
-- Home is now the first onboarding step. A stored install or reminders was
-- reached under the old order, before any profile step, so those Users start
-- again (Home if they have none, then the profile steps). Every other stored
-- value keeps its meaning.
UPDATE users SET onboarding_step = NULL WHERE onboarding_step IN ('install', 'reminders');

-- +goose Down
-- No-op: the reset values cannot be told apart from Users who never started.
SELECT 1;
