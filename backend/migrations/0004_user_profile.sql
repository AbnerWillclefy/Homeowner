-- A User's profile: Baseline Energy per weekday, Preference per Category and
-- Restrictions on Demands. It belongs to the User, not the Resident, so it
-- survives leaving a Home. Expand only: three new tables, nothing existing
-- changes.
--
-- Rows exist only for what is set: an unset Baseline day has no row (not 0),
-- and a neutral Preference has no row. Category and Demand ids are validated
-- in Go (internal/vocab), so adding one needs no migration.
-- The points range is a named constant in Go; the CHECK is the last guard.

-- +goose Up
CREATE TABLE user_baselines (
    user_id uuid     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
    points  smallint NOT NULL CHECK (points BETWEEN 0 AND 20),
    PRIMARY KEY (user_id, weekday)
);

CREATE TABLE user_category_preferences (
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category   text NOT NULL,
    preference text NOT NULL CHECK (preference IN ('like', 'dislike')),
    PRIMARY KEY (user_id, category)
);

CREATE TABLE user_demand_restrictions (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    demand  text NOT NULL,
    PRIMARY KEY (user_id, demand)
);

-- +goose Down
DROP TABLE user_demand_restrictions;
DROP TABLE user_category_preferences;
DROP TABLE user_baselines;
