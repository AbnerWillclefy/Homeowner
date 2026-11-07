-- A User's own Pluggy Client ID and Secret, so the app can read their banks.
-- Expand only: one new table, nothing existing is touched.
--
-- The values are sealed with AES-256-GCM in Go (internal/finance/seal.go) under
-- a key kept in SSM, never here: each column holds version || nonce ||
-- ciphertext. key_version repeats the version byte so a later key rotation can
-- find old rows with SQL. The table belongs to the User alone and references
-- no Home, so it goes when the User goes.

-- +goose Up
CREATE TABLE finance_credentials (
    user_id           uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    client_id_enc     bytea       NOT NULL,
    client_secret_enc bytea       NOT NULL,
    key_version       smallint    NOT NULL,
    updated_at        timestamptz NOT NULL
);

-- +goose Down
DROP TABLE finance_credentials;
