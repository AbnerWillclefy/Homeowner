import assert from "node:assert/strict";
import { test } from "node:test";
import { answer } from "./revenue-fake-api.mjs";
import { changedScreens } from "./revenue-screenshots.mjs";

test("shoots the screen of each changed domain, ignoring shared files beside them", () => {
  const changed = ["revenue/src/domains/transactions/api.ts", "revenue/src/domains/card-bills/CardBillsPage.tsx", "revenue/src/shared/i18n/catalogs.ts"];
  assert.deepEqual(changedScreens(changed), ["/card-bills", "/transactions"]);
});

test("names the Overview by its route, and shoots it when only shared code changed", () => {
  assert.deepEqual(changedScreens(["revenue/src/domains/overview/OverviewPage.tsx"]), ["/"]);
  assert.deepEqual(changedScreens(["revenue/src/app/Shell.tsx"]), ["/"]);
});

test("dates no transaction after today in the current month", () => {
  const { body } = answer("GET", new URL("http://api/me/finance/transactions?month=2026-11"), "2026-11-03");
  assert.ok(body.transactions.every((t) => t.postedOn >= "2026-11-01" && t.postedOn <= "2026-11-03"));
});

test("answers nothing for a request it has no fake for", () => {
  assert.equal(answer("GET", new URL("http://api/me/finance/goals"), "2026-11-03"), null);
});

test("serves the Pantry with items in both states, one with a brand and one always bought", () => {
  const { body } = answer("GET", new URL("http://api/me/finance/pantry"), "2026-11-03");
  assert.deepEqual([...new Set(body.items.map((i) => i.state))].sort(), ["in_stock", "ran_out"]);
  assert.ok(body.items.some((i) => i.fixed) && body.items.some((i) => i.preferredBrand));
  assert.ok(body.items.filter((i) => i.state === "ran_out").every((i) => i.ranOutOn <= "2026-11-03"));
});

test("shoots the Pantry and its shopping list when the pantry folder changed", () => {
  assert.deepEqual(changedScreens(["revenue/src/domains/pantry/PantryPage.tsx"]), ["/pantry", "/pantry/list"]);
  assert.deepEqual(changedScreens(["revenue/src/domains/pantry/ShoppingListPage.tsx", "revenue/src/domains/bills/api.ts"]), ["/bills", "/pantry", "/pantry/list"]);
});

test("serves a shopping list with priced, unpriced and kg lines and a groceries left below the total", () => {
  const { status, body } = answer("GET", new URL("http://api/me/finance/pantry/list"), "2026-11-03");
  assert.equal(status, 200);
  assert.ok(body.items.some((i) => i.priceCents === undefined) && body.items.some((i) => i.unit === "KG" && i.priceCents !== undefined));
  assert.equal(body.expectedTotalCents, body.items.reduce((sum, i) => sum + (i.priceCents ?? 0), 0));
  assert.ok(body.groceriesLeftCents < body.expectedTotalCents);
  assert.equal(answer("PUT", new URL("http://api/me/finance/pantry/list/p1"), "2026-11-03").status, 204);
});

test("serves a receipt with unmatched lines, and answers a match with it", () => {
  const created = answer("POST", new URL("http://api/me/finance/pantry/receipts"), "2026-11-03");
  assert.equal(created.status, 201);
  assert.ok(created.body.lines.filter((l) => l.itemId === null && !l.ignored).length >= 2);
  assert.equal(answer("PUT", new URL("http://api/me/finance/pantry/receipts/r1/lines/2"), "2026-11-03").status, 200);
});

test("serves an item's price history newest first, and 404 for an unknown item", () => {
  const id = answer("GET", new URL("http://api/me/finance/pantry"), "2026-11-03").body.items[0].id;
  const { status, body } = answer("GET", new URL(`http://api/me/finance/pantry/items/${id}`), "2026-11-03");
  assert.equal(status, 200);
  assert.ok(body.prices.length >= 2 && body.prices.every((p, i, a) => i === 0 || a[i - 1].issuedOn >= p.issuedOn));
  assert.equal(answer("GET", new URL("http://api/me/finance/pantry/items/nope"), "2026-11-03").status, 404);
});

test("serves a photo draft with lines that add up to its total", () => {
  const { status, body } = answer("POST", new URL("http://api/me/finance/pantry/receipts/photo"), "2026-11-03");
  assert.equal(status, 200);
  assert.equal(body.draft.issuedOn, "2026-11-03");
  assert.ok(body.draft.lines.length >= 2);
  assert.equal(body.draft.lines.reduce((sum, l) => sum + l.totalCents, 0), body.draft.totalCents);
});
