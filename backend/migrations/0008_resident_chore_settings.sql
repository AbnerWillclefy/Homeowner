-- A Resident's Preference and Restriction on one specific Chore of their Home.
-- They beat the User's general ones (see CONTEXT.md). Expand only: two new
-- tables, nothing existing changes.
--
-- Keyed to the Resident, not the User: leaving a Home deletes the residents
-- row and the cascade clears these, so a Resident who joins another Home
-- starts clean. Any Chore can be deleted, hence the cascade on chore_id.
--
-- Unlike the general Preference (neutral = no row), a specific one stores all
-- three values: a specific neutral must be able to beat a general dislike.
-- Clearing deletes the row, which hands the decision back to the general one.
--
-- Nothing in SQL stops a Resident of Home A having a row for a Chore of Home
-- B. The Store enforces it in Go: every insert proves, in the same statement,
-- that the Chore's home_id equals the Resident's home_id.

-- +goose Up
CREATE TABLE resident_chore_preferences (
    resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    chore_id    uuid NOT NULL REFERENCES chores (id) ON DELETE CASCADE,
    preference  text NOT NULL CHECK (preference IN ('like', 'neutral', 'dislike')),
    PRIMARY KEY (resident_id, chore_id)
);
CREATE INDEX resident_chore_preferences_chore_id_idx ON resident_chore_preferences (chore_id);

CREATE TABLE resident_chore_restrictions (
    resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    chore_id    uuid NOT NULL REFERENCES chores (id) ON DELETE CASCADE,
    PRIMARY KEY (resident_id, chore_id)
);
CREATE INDEX resident_chore_restrictions_chore_id_idx ON resident_chore_restrictions (chore_id);

-- +goose Down
DROP TABLE resident_chore_restrictions;
DROP TABLE resident_chore_preferences;
