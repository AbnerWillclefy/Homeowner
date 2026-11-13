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
