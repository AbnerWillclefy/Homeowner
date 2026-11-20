-- The per-User daily count of finance chat questions, and the chat as an LLM
-- service in llm_call_events. Expand only: one new table, and a CHECK that is
-- widened (every row the old one allowed still passes).
--
-- finance_chat_calls counts the questions reserved per User and São Paulo date,
-- the way voice_calls does. It holds counts only, never text. A chat row in
-- llm_call_events is numbers, outcome and cost only (ADR 0027).

-- +goose Up
CREATE TABLE finance_chat_calls (
    user_id   uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    call_date date    NOT NULL,
    questions integer NOT NULL CHECK (questions >= 0),
    PRIMARY KEY (user_id, call_date)
);

ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer', 'voice', 'receipt', 'chat'));

-- +goose Down
DELETE FROM llm_call_events WHERE service = 'chat';
ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer', 'voice', 'receipt'));
DROP TABLE finance_chat_calls;
