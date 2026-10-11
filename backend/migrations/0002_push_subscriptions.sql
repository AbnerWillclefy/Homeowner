-- One row per device (browser push endpoint). There is no user link yet: the
-- auth ticket adds it in its own migration.

-- +goose Up
CREATE TABLE push_subscriptions (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint   text        NOT NULL UNIQUE,
    p256dh     text        NOT NULL,
    auth       text        NOT NULL,
    user_agent text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

-- +goose Down
DROP TABLE push_subscriptions;
