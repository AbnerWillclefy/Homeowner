-- The Resident responsible for a Chore, or none (Nobody). Expand only:
-- nullable, so every existing Chore stays with everyone. ON DELETE SET NULL
-- clears it when the Resident leaves the Home. The index serves that cascade
-- and the updates that clear it when a Restriction is added.

-- +goose Up
ALTER TABLE chores ADD COLUMN responsible_resident_id uuid REFERENCES residents (id) ON DELETE SET NULL;
CREATE INDEX chores_responsible_resident_idx ON chores (responsible_resident_id);

-- +goose Down
DROP INDEX chores_responsible_resident_idx;
ALTER TABLE chores DROP COLUMN responsible_resident_id;
