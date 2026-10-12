-- A Resident's Check-in for one local day: how they feel (which scales their
-- Baseline into that day's Energy) and the Restrictions that hold for that day
-- only. Expand only: two new tables, nothing existing changes.
--
-- checkin_date is the date in the Home's zone when the Check-in was made, never
-- the UTC one. UNIQUE (resident_id, checkin_date) makes a second Check-in the
-- same day replace the first. A Check-in belongs to the Resident, so it goes
-- when they leave the Home.
--
-- There is nothing to clean up the next day: rows are keyed by date, so
-- yesterday's Check-in and day Restrictions are simply not read. Old rows are
-- history. Day Restrictions are not user_demand_restrictions, which are lasting.
-- Demand ids are validated in Go, as there.

-- +goose Up
CREATE TABLE checkins (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id  uuid        NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
    checkin_date date        NOT NULL,
    level        text        NOT NULL CHECK (level IN ('drained', 'low', 'normal', 'energized')),
    created_at   timestamptz NOT NULL,
    updated_at   timestamptz NOT NULL,
    UNIQUE (resident_id, checkin_date)
);

CREATE TABLE checkin_demand_restrictions (
    checkin_id uuid NOT NULL REFERENCES checkins (id) ON DELETE CASCADE,
    demand     text NOT NULL,
    PRIMARY KEY (checkin_id, demand)
);

-- +goose Down
DROP TABLE checkin_demand_restrictions;
DROP TABLE checkins;
