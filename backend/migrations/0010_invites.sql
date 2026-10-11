-- An Invite: a single-use link a Resident shares to bring a new Resident into
-- their Home, valid for seven days. Expand only: one new table, nothing
-- existing changes.
--
-- Only the SHA-256 hash of the token is stored, so a database leak does not
-- hand out working links. created_by is SET NULL: the creator may leave, and
-- the Invite belongs to the Home and stays valid. Timestamps come from the
-- application clock, never now(). An Invite is valid while now < expires_at
-- and used_at is null.

-- +goose Up
CREATE TABLE invites (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id    uuid        NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    token_hash bytea       NOT NULL UNIQUE,
    created_by uuid        NULL REFERENCES residents (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz NULL,
    used_by    uuid        NULL REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX invites_home_id_idx ON invites (home_id);

-- +goose Down
DROP INDEX invites_home_id_idx;
DROP TABLE invites;
