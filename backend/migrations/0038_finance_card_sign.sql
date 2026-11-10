-- Card rows were stored with Pluggy's sign, where a purchase is positive, so
-- every purchase read as a refund. Flip them to the Source's point of view,
-- and start the import again so the sync re-classifies 12 months with the new
-- sign (bill payments become Transfers again); the upsert keeps every row's id.

-- +goose Up
UPDATE finance_transactions t SET amount_cents = -t.amount_cents
FROM finance_sources s WHERE s.id = t.source_id AND s.kind = 'credit_card';
UPDATE finance_sources SET import_cursor = NULL;
UPDATE finance_items SET import_complete = false;

-- +goose Down
UPDATE finance_transactions t SET amount_cents = -t.amount_cents
FROM finance_sources s WHERE s.id = t.source_id AND s.kind = 'credit_card';
