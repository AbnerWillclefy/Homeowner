-- A User gains an optional display name and the key of an optional photo.
-- Expand only: two new nullable columns, no default, no backfill. The old
-- binary names its columns, so this is safe to deploy before the new code.
--
-- Go is the real validator (it trims Unicode whitespace and rejects control
-- characters); these CHECKs are the last guard. char_length counts code
-- points in a UTF-8 database, as Go's utf8.RuneCountInString does. btrim strips
-- only ASCII spaces, which catches the common mistake.

-- +goose Up
ALTER TABLE users
    ADD COLUMN display_name text,
    ADD COLUMN photo_key text,
    ADD CONSTRAINT users_display_name_shape
        CHECK (char_length(display_name) BETWEEN 1 AND 40 AND display_name = btrim(display_name)),
    ADD CONSTRAINT users_photo_key_shape
        CHECK (photo_key ~ '^avatars/[A-Za-z0-9_-]{22,}\.(webp|jpg)$');

-- +goose Down
ALTER TABLE users
    DROP CONSTRAINT users_photo_key_shape,
    DROP CONSTRAINT users_display_name_shape,
    DROP COLUMN photo_key,
    DROP COLUMN display_name;
