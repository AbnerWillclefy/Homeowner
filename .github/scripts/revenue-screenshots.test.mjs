import assert from "node:assert/strict";
import { test } from "node:test";
import { answer, TODAY } from "./revenue-fake-api.mjs";
import { changedScreens, FIXED_TIME, overflowOf, TIMEZONE } from "./revenue-screenshots.mjs";

const MONTH = TODAY.slice(0, 7);
const read = (path, today) => answer("GET", new URL(`http://api${path}`), today);

test("shoots the screen of each changed domain, ignoring shared files beside them", () => {
  const changed = ["revenue/src/domains/transactions/api.ts", "revenue/src/domains/card-bills/CardBillsPage.tsx", "revenue/src/shared/i18n/catalogs.ts"];
  assert.deepEqual(changedScreens(changed), ["/card-bills", "/transactions"]);
});

test("names the Overview by its route, and shoots it when only shared code changed", () => {
  assert.deepEqual(changedScreens(["revenue/src/domains/overview/OverviewPage.tsx"]), ["/"]);
  assert.deepEqual(changedScreens(["revenue/src/shared/i18n/catalogs.ts"]), ["/"]);
});

test("shoots the Overview, Plan and More when the app frame changed", () => {
  assert.deepEqual(changedScreens(["revenue/src/app/Shell.tsx"]), ["/", "/plan", "/more"]);
  assert.deepEqual(changedScreens(["revenue/src/app/Shell.tsx", "revenue/src/domains/bills/api.ts"]), ["/", "/plan", "/more", "/bills"]);
});

test("passes a page that fits and names the widest element of one that overflows", () => {
  assert.equal(overflowOf("/", { scrollWidth: 375, innerWidth: 375, offenders: [] }), null);
  const message = overflowOf("/more", { scrollWidth: 412, innerWidth: 375, offenders: [{ description: "<td> small", right: 390 }, { description: "<table> wide", right: 412 }] });
  assert.match(message, /\/more/);
  assert.match(message, /412px wide in a 375px/);
  assert.match(message, /<table> wide/);
  assert.doesNotMatch(message, /small/);
});

// The reads each screen the check shoots makes on load, with the frozen month in the params (the URLs the app sends).
const READS = {
  "/": ["/me/finance", `/me/finance/history?to=${MONTH}&months=2`, `/me/finance/commitments?from=${MONTH}`, `/me/finance/transactions?month=${MONTH}`, `/me/finance/bills?month=${MONTH}`, "/me/finance/net-worth?range=30d", "/me/finance/savings"],
  "/plan": [`/me/finance/commitments?from=${MONTH}`, "/me/finance/savings", `/me/finance/bills?month=${MONTH}`],
  "/more": ["/me/finance", `/me/finance/commitments?from=${MONTH}`],
  "/transactions": [`/me/finance/transactions?month=${MONTH}`],
  "/categories": [`/me/finance/transactions?month=${MONTH}`, `/me/finance/history?to=${MONTH}&months=2`],
  "/bills": [`/me/finance/bills?month=${MONTH}`, "/me/finance/bill-suggestions"],
  "/card-bills": ["/me/finance", `/me/finance/commitments?from=${MONTH}`, `/me/finance/transactions?month=${MONTH}`, "/me/finance/card-bills?source=s1&months=6", "/me/finance/card-bills?source=s3&months=6"],
  "/goals": ["/me/finance/savings", `/me/finance/commitments?from=${MONTH}`],
  "/net-worth": ["/me/finance/net-worth?range=30d", "/me/finance/net-worth?range=90d", "/me/finance/net-worth?range=1y"],
  "/projection": [`/me/finance/commitments?from=${MONTH}`],
  "/sources": ["/me/finance", "/me/finance/manual-cards"],
  "/pantry": ["/me/finance/pantry"],
  "/pantry/list": ["/me/finance/pantry/list", "/me/finance/pantry"],
  "/pantry/item": ["/me/finance/pantry/items/p4"],
  "/settings": ["/me/finance", `/me/finance/commitments?from=${MONTH}`],
};
const TICKET_ROUTES = ["", "/transactions", "/history", "/commitments", "/card-bills", "/bills", "/bill-suggestions", "/savings", "/net-worth", "/pantry", "/pantry/list", "/pantry/items/", "/manual-cards"];

test("serves every read of every shot screen, in the frozen month", () => {
  const reads = Object.values(READS).flat();
  for (const path of TICKET_ROUTES) assert.ok(reads.some((r) => r.startsWith(`/me/finance${path}`) && (path !== "" || r === "/me/finance")), `no read of ${path} in the table`);
  for (const read_ of reads) {
    const found = read(read_);
    assert.ok(found && found.status >= 200 && found.status < 300, read_);
    assert.ok(found.body, read_);
  }
});

test("the screenshot clock and the fake's today are the same day", () => {
  assert.equal(new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(FIXED_TIME)), TODAY);
});

test("answers with TODAY when no date is given, and dates no transaction after it", () => {
  const { body } = read(`/me/finance/transactions?month=${MONTH}`);
  const days = body.transactions.map((t) => t.postedOn);
  assert.ok(days.length >= 10);
  assert.ok(days.every((d) => d.startsWith(MONTH) && d <= TODAY));
  assert.equal(Math.max(...days.map((d) => Number(d.slice(8)))), Number(TODAY.slice(8)));
});

test("serves the artboards' household: Transactions", () => {
  const { body } = read(`/me/finance/transactions?month=${MONTH}`);
  const first = body.transactions[0];
  assert.ok(["Pão de Açúcar", "Uber"].includes(first.description));
  const pao = body.transactions.find((t) => t.description === "Pão de Açúcar");
  assert.equal(pao.amountCents, -18_732);
  assert.equal(body.spentCents, 512_741);
  assert.equal(body.transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amountCents, 0), 980_000);
});

test("serves the artboards' household: Accounts and Card bills", () => {
  const { sources, lastSyncedAt } = read("/me/finance").body;
  assert.deepEqual(sources.filter((s) => s.kind === "credit_card").map((s) => [s.name, s.closeDay, s.dueDay, s.creditLimitCents]), [["Nubank Ultravioleta", 3, 10, 1_200_000], ["Itaú Click", 28, 6, 600_000]]);
  assert.deepEqual(sources.filter((s) => s.kind === "checking").map((s) => s.balanceCents), [624_018, 193_240]);
  assert.equal(Date.parse(FIXED_TIME) - Date.parse(lastSyncedAt), 2 * 3_600_000);
  const cards = read(`/me/finance/commitments?from=${MONTH}`).body.months[0].cards;
  assert.deepEqual(cards.map((c) => c.amountCents), [241_822, 94_166]);
  assert.equal(read("/me/finance/card-bills?source=s1&months=6").body.averageCents, 220_340);
  assert.deepEqual(read("/me/finance/manual-cards").body.cards, []);
});

test("serves the artboards' household: Overview and Projection", () => {
  const { monthlyIncomeCents, months } = read(`/me/finance/commitments?from=${MONTH}`).body;
  assert.equal(monthlyIncomeCents, 1_250_000);
  assert.equal(months[0].leftoverCents, 151_725);
  assert.equal(months[0].pace.spentCents.at(-1), 162_741);
  assert.equal(months[0].pace.spentCents.length, Number(TODAY.slice(8)));
  assert.deepEqual(months[0].installments.map((i) => [i.name, i.number, i.total, i.amountCents]).slice(0, 3), [["Geladeira Frost Free", 3, 10, 32_490], ["Mercado Livre", 6, 10, 23_343], ["Canadian Solar", 5, 12, 162_309]]);
  assert.equal(months.length, 12);
});

test("serves the artboards' household: Bills", () => {
  const rows = read(`/me/finance/bills?month=${MONTH}`).body;
  assert.deepEqual(rows.map((b) => [b.name, b.dueDate.slice(8), b.expectedCents, b.paid]), [["Aluguel novembro", "05", 350_000, true], ["Enel", "13", 21_440, false], ["Vivo Fibra", "15", 11_990, false], ["Sabesp", "18", 14_155, false]]);
  assert.equal(rows.reduce((sum, b) => sum + b.expectedCents, 0), 397_585);
  assert.deepEqual(read("/me/finance/bill-suggestions").body.map((s) => s.name), ["Spotify", "Netflix"]);
});

test("serves the artboards' household: Goals", () => {
  const s = read("/me/finance/savings").body;
  assert.deepEqual([s.contributionBaseCents, s.reserveSharePercent, s.reserve.savedCents, s.reserve.targetCents], [120_000, 50, 2_450_000, 3_000_000]);
  assert.deepEqual(s.goals.map((g) => [g.name, g.savedCents, g.targetCents]), [["Viagem para o Chile", 300_000, 600_000], ["Notebook novo", 200_000, 900_000]]);
  assert.deepEqual(s.leftover, { leftoverCents: 151_725, extraCents: 50_000, monthsSooner: 2 });
  assert.equal(s.investments.reduce((sum, i) => sum + i.valueCents, 0), 4_350_000);
});

test("serves the artboards' household: Net worth, Categories", () => {
  const nw = read("/me/finance/net-worth?range=30d").body;
  assert.equal(nw.today.totalCents, 4_831_270);
  assert.equal(nw.today.balancesCents + nw.today.investmentsCents - nw.today.cardBillsCents, nw.today.totalCents);
  assert.equal(nw.series.length, 30);
  assert.equal(nw.series.at(-1).day, TODAY);
  const { limits, categories } = read(`/me/finance/transactions?month=${MONTH}`).body;
  assert.equal(Object.values(limits).reduce((a, b) => a + b, 0), 498_300);
  assert.equal(categories.find((c) => c.category === "groceries").spentCents, 61_230);
  const history = read(`/me/finance/history?to=${MONTH}&months=2`).body.months;
  assert.equal(history.length, 2);
  assert.equal(history.at(-1).month, MONTH);
  assert.equal(history.at(-1).incomeCents - history.at(-1).spentCents - history.at(-1).savedCents, 347_259);
});

test("answers nothing for a request it has no fake for", () => {
  assert.equal(answer("GET", new URL("http://api/me/finance/goals"), TODAY), null);
});

test("serves the Pantry with items in both states, one with a brand and one always bought", () => {
  const { body } = answer("GET", new URL("http://api/me/finance/pantry"), TODAY);
  assert.deepEqual([...new Set(body.items.map((i) => i.state))].sort(), ["in_stock", "ran_out"]);
  assert.ok(body.items.some((i) => i.fixed) && body.items.some((i) => i.preferredBrand));
  const ranOut = body.items.filter((i) => i.state === "ran_out");
  assert.deepEqual(ranOut.map((i) => i.name), ["Leite", "Café", "Sabão em pó"]);
  assert.ok(ranOut.every((i) => i.ranOutOn <= TODAY));
});

test("shoots the Pantry and its shopping list when the pantry folder changed", () => {
  assert.deepEqual(changedScreens(["revenue/src/domains/pantry/PantryPage.tsx"]), ["/pantry", "/pantry/list"]);
  assert.deepEqual(changedScreens(["revenue/src/domains/pantry/ShoppingListPage.tsx", "revenue/src/domains/bills/api.ts"]), ["/bills", "/pantry", "/pantry/list"]);
});

test("serves a shopping list with priced, unpriced and kg lines and a groceries limit with room left", () => {
  const { status, body } = answer("GET", new URL("http://api/me/finance/pantry/list"), TODAY);
  assert.equal(status, 200);
  assert.ok(body.items.some((i) => i.priceCents === undefined) && body.items.some((i) => i.unit === "KG" && i.priceCents !== undefined));
  assert.equal(body.expectedTotalCents, body.items.reduce((sum, i) => sum + (i.priceCents ?? 0), 0));
  assert.equal(body.groceriesLeftCents, 15_849);
  assert.deepEqual(body.items.map((i) => i.name), ["Arroz", "Feijão", "Queijo minas", "Café", "Sal", "Peito de frango"]);
  assert.equal(answer("PUT", new URL("http://api/me/finance/pantry/list/p1"), TODAY).status, 204);
});

test("serves a receipt with unmatched lines, and answers a match with it", () => {
  const created = answer("POST", new URL("http://api/me/finance/pantry/receipts"), TODAY);
  assert.equal(created.status, 201);
  assert.ok(created.body.lines.filter((l) => l.itemId === null && !l.ignored).length >= 2);
  assert.equal(answer("PUT", new URL("http://api/me/finance/pantry/receipts/r1/lines/2"), TODAY).status, 200);
});

test("serves an item's price history newest first, and 404 for an unknown item", () => {
  const id = answer("GET", new URL("http://api/me/finance/pantry"), TODAY).body.items[0].id;
  const { status, body } = answer("GET", new URL(`http://api/me/finance/pantry/items/${id}`), TODAY);
  assert.equal(status, 200);
  assert.ok(body.prices.length >= 2 && body.prices.every((p, i, a) => i === 0 || a[i - 1].issuedOn >= p.issuedOn));
  assert.equal(answer("GET", new URL("http://api/me/finance/pantry/items/nope"), TODAY).status, 404);
});

test("serves a photo draft with lines that add up to its total", () => {
  const { status, body } = answer("POST", new URL("http://api/me/finance/pantry/receipts/photo"), TODAY);
  assert.equal(status, 200);
  assert.equal(body.draft.issuedOn, TODAY);
  assert.ok(body.draft.lines.length >= 2);
  assert.equal(body.draft.lines.reduce((sum, l) => sum + l.totalCents, 0), body.draft.totalCents);
});
