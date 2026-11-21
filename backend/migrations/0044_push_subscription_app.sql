-- Each push subscription belongs to the app it was made in: Homeowner or Revenue.
-- Expand only: one new column with a default, so existing rows stay Homeowner's
-- and the running API keeps working. UNIQUE (endpoint) stays: a browser issues a
-- different endpoint per origin, so one endpoint never serves both apps.

-- +goose Up
ALTER TABLE push_subscriptions
    ADD COLUMN app text NOT NULL DEFAULT 'homeowner' CHECK (app IN ('homeowner', 'revenue'));

-- +goose Down
ALTER TABLE push_subscriptions DROP COLUMN app;
