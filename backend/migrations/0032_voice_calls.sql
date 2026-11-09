-- The per-Resident daily count of voice calls, and voice as an LLM service in
-- llm_call_events. Expand only: one new table, and a CHECK that is widened
-- (every row the old one allowed still passes).
--
-- voice_calls counts the calls reserved per User and local date of the Home, the
-- way finance_llm_calls does. It holds counts only, never text. A voice row in
-- llm_call_events is ids, counts and cost only (ADR 0020).

-- +goose Up
CREATE TABLE voice_calls (
    user_id   uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    call_date date    NOT NULL,
    calls     integer NOT NULL CHECK (calls >= 0),
    PRIMARY KEY (user_id, call_date)
);

ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer', 'voice'));

-- +goose Down
DELETE FROM llm_call_events WHERE service = 'voice';
ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer'));
DROP TABLE voice_calls;
