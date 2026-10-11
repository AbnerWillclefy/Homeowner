-- A User is a person with an account, identified by their Cognito subject.
-- Expand only: push_subscriptions.user_id is nullable so the previous release,
-- which does not set it, keeps working while this migration is live.

-- +goose Up
CREATE TABLE users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub text        NOT NULL UNIQUE,
    email       text        NOT NULL,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL
);

ALTER TABLE push_subscriptions
    ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE push_subscriptions DROP COLUMN user_id;
DROP TABLE users;
