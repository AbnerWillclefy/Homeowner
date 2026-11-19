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

test("shoots the Pantry by its route", () => {
  assert.deepEqual(changedScreens(["revenue/src/domains/pantry/PantryPage.tsx"]), ["/pantry"]);
});

test("serves a receipt with unmatched lines, and answers a match with it", () => {
  const created = answer("POST", new URL("http://api/me/finance/pantry/receipts"), "2026-11-03");
  assert.equal(created.status, 201);
  assert.ok(created.body.lines.filter((l) => l.itemId === null && !l.ignored).length >= 2);
  assert.equal(answer("PUT", new URL("http://api/me/finance/pantry/receipts/r1/lines/2"), "2026-11-03").status, 200);
});
