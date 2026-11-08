-- The User's own Spending Category for a merchant, the cap on Categorizer calls,
-- and the Categorizer as an LLM service in llm_call_events. Expand only: two new
-- tables, and a CHECK that is widened (every row the old one allowed still passes).
--
-- finance_merchant_categories is the User's saved correction for a
-- merchant_key; the sync tries it first. finance_llm_calls counts the calls
-- reserved per User and Sao Paulo day, the way llm_calls does per Home. Neither
-- holds a Home. llm_call_events keeps no user id: a 'categorizer' row is counts
-- and cost only, so the admin app learns nothing about anyone's finances.

-- +goose Up
CREATE TABLE finance_merchant_categories (
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    merchant_key      text        NOT NULL,
    spending_category text        NOT NULL CHECK (spending_category IN ('housing', 'household_bills', 'groceries',
                           'eating_out', 'transport', 'health', 'education', 'leisure', 'shopping',
                           'subscriptions', 'pets', 'taxes_fees', 'other')),
    updated_at        timestamptz NOT NULL,
    PRIMARY KEY (user_id, merchant_key)
);

CREATE TABLE finance_llm_calls (
    user_id   uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    call_date date    NOT NULL,
    calls     integer NOT NULL CHECK (calls >= 0),
    PRIMARY KEY (user_id, call_date)
);

ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer', 'categorizer'));

-- +goose Down
DELETE FROM llm_call_events WHERE service = 'categorizer';
ALTER TABLE llm_call_events DROP CONSTRAINT llm_call_events_service_check;
ALTER TABLE llm_call_events ADD CONSTRAINT llm_call_events_service_check
    CHECK (service IN ('allocator', 'explainer'));
DROP TABLE finance_llm_calls;
DROP TABLE finance_merchant_categories;
