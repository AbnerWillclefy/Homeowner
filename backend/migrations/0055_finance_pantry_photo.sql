-- Receipt photos: the per-User daily count of photo reads, receipt as an LLM
-- service in llm_call_events, and the duplicate rule for a receipt without a
-- key. Expand only: one new table, a CHECK that is widened (every row the old
-- one allowed still passes) and a new partial unique index.
--
-- finance_pantry_photo_calls counts the calls reserved per User and local date,
-- the way voice_calls does. It holds counts only. A receipt row in
-- llm_call_events is ids, counts and cost only (ADR 0026).
--
-- The index makes a photo of the same store, date and total a duplicate. A
-- receipt with a key is deduplicated by UNIQUE (user_id, access_key) instead.

-- +goose Up
CREATE TABLE finance_pantry_photo_calls (
    user_id   uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    call_date date    NOT NULL,
    calls     integer NOT NULL CHECK (calls >= 0),
    PRIMARY KEY (user_id, call_date)
);

ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer', 'voice', 'receipt'));

CREATE UNIQUE INDEX finance_pantry_receipts_photo_dup_idx
    ON finance_pantry_receipts (user_id, lower(store_name), issued_on, total_cents)
    WHERE access_key IS NULL;

-- +goose Down
DROP INDEX finance_pantry_receipts_photo_dup_idx;
DELETE FROM llm_call_events WHERE service = 'receipt';
ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer', 'voice'));
DROP TABLE finance_pantry_photo_calls;
