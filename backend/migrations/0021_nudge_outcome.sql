-- What the push service answered for a nudge, so push failures are visible.
-- Expand only: one nullable column, no default, nothing existing changes.
--
-- outcome is one of:
--   delivered  at least one of the Resident's devices was accepted by the push
--              service (a 2xx). It does NOT mean the phone showed the message:
--              label it "accepted by push service", never "received".
--   failed     no device accepted it and at least one failed with an error
--              other than "gone".
--   gone       every device answered gone (410/404); they are pruned already.
--
-- NULL means one of: a row from before this migration; a crash between the
-- claim and the send; or a claim whose send was dropped because the tick's
-- nudge deadline ran out (the last is the most common). Nothing is retried.
--
-- The row is per Resident, kind and date, so the outcome combines the
-- Resident's devices. It disappears with the Resident (ON DELETE CASCADE).

-- +goose Up
ALTER TABLE nudges ADD COLUMN outcome text CHECK (outcome IN ('delivered', 'failed', 'gone'));

-- +goose Down
ALTER TABLE nudges DROP COLUMN outcome;
