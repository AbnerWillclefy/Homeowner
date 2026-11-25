// The API answers Revenue's screenshots are taken against: the household of the desktop artboards in docs/design/revenue/,
// frozen on TODAY. A screen that reads a new endpoint adds its answer here, or revenue-screenshots.mjs fails naming the request.
// What the API cannot express is not bent into the fake; the PR that last changed these figures lists it.

/** The day every screenshot is taken on (the desktop artboards are drawn on 11 Nov), in São Paulo; revenue-screenshots.mjs freezes the browser clock to it. */
export const TODAY = "2026-11-11";

// [id, description, amountCents, type, spendingCategory, source name, day of the month, installment, note]; newest first, as the artboard lists them.
const ROWS = [
  ["Pão de Açúcar", -18_732, "expense", "groceries", "Nubank Ultravioleta", 11],
  ["Uber", -2_340, "expense", "transport", "Nubank Ultravioleta", 11],
  ["iFood", -6_490, "expense", "eating_out", "Nubank Ultravioleta", 10],
  ["Drogasil", -9_800, "expense", "health", "Itaú Click", 10],
  ["Netflix", -4_490, "expense", "subscriptions", "Itaú Click", 9],
  ["Acme Design", 150_000, "income", null, "Nubank", 8],
  ["Outback", -21_250, "expense", "eating_out", "Nubank Ultravioleta", 8],
  ["Shell", -18_000, "expense", "transport", "Itaú", 7],
  ["Salário", 830_000, "income", null, "Nubank", 5],
  ["Aluguel novembro", -350_000, "expense", "housing", "Nubank", 5],
  ["Aporte reserva", -60_000, "saving", null, "Nubank", 5],
  // The card bills' own rows, below the Transactions artboard's.
  ["Notebook Dell", -45_000, "expense", "shopping", "Nubank Ultravioleta", 4, { number: 3, total: 10 }],
  ["Passagem LATAM", -50_000, "expense", "leisure", "Nubank Ultravioleta", 4, { number: 2, total: 6 }],
  ["Amazon", -28_990, "expense", "shopping", "Itaú Click", 3],
];

const SOURCES = [
  { id: "s1", name: "Nubank Ultravioleta", bankName: "Nubank", kind: "credit_card", currency: "BRL", closeDay: 3, dueDay: 10, creditLimitCents: 1_200_000 },
  { id: "s3", name: "Itaú Click", bankName: "Itaú", kind: "credit_card", currency: "BRL", closeDay: 28, dueDay: 6, creditLimitCents: 600_000 },
  { id: "s2", name: "Nubank", bankName: "Nubank", kind: "checking", currency: "BRL", closeDay: null, dueDay: null },
  { id: "s4", name: "Itaú", bankName: "Itaú", kind: "checking", currency: "BRL", closeDay: null, dueDay: null },
];
const BALANCES = { s2: 624_018, s4: 193_240 };
const ITEMS = [
  { id: "i1", bankName: "Nubank", status: "ok", products: 3 },
  { id: "i2", bankName: "Itaú", status: "ok", products: 2 },
  { id: "i3", bankName: "XP Investimentos", status: "reconnect", products: 1 },
];
const SOURCE_ID = Object.fromEntries(SOURCES.map((s) => [s.name, s.id]));

const pad = (n) => String(n).padStart(2, "0");

/** `from` plus `n` months, as `YYYY-MM`. */
function addMonths(from, n) {
  const index = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1 + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** The instant `hours` before midday São Paulo time on `today`. */
const hoursBeforeMidday = (today, hours) => new Date(Date.parse(`${today}T12:00:00-03:00`) - hours * 3_600_000).toISOString();

/** The artboard's November in any month, same days of the month (all on or before TODAY's). */
function transactions(month) {
  const rows = ROWS.map(([description, amountCents, type, spendingCategory, sourceName, day, installment = null], i) => ({
    id: `t${i + 1}`, sourceId: SOURCE_ID[sourceName], postedOn: `${month}-${pad(day)}`, countsOn: `${month}-${pad(day)}`, description, sourceName, amountCents, currency: "BRL", type, spendingCategory,
    installment, note: null,
  }));
  return {
    month,
    // The 64 transactions' totals, of which the rows above are the latest ones. Moradia counts here, and the Overview takes it out as a fixed bill.
    spentCents: 512_741,
    categories: Object.entries({ housing: 350_000, groceries: 61_230, eating_out: 38_490, transport: 22_160, subscriptions: 14_770, health: 9_800, leisure: 8_500, other: 7_791 }).map(([category, spentCents]) => ({ category, spentCents })),
    limits: { groceries: 150_000, eating_out: 45_000, transport: 60_000, subscriptions: 18_300, health: 40_000, leisure: 95_000, other: 20_000, shopping: 70_000 },
    transactions: rows,
  };
}

const BILLS = [
  { id: "b1", name: "Aluguel novembro", expectedCents: 350_000, dueDay: 5 },
  { id: "b2", name: "Enel", expectedCents: 21_440, dueDay: 13 },
  { id: "b3", name: "Vivo Fibra", expectedCents: 11_990, dueDay: 15 },
  { id: "b4", name: "Sabesp", expectedCents: 14_155, dueDay: 18 },
];
const PACE_DAYS = [30_000, 22_000, 14_000, 17_939, 6_490, 21_250, 0, 18_000, 2_190, 9_800, 21_072];

/** Twelve months from `from`; the 3rd takes more than the income, the Geladeira plan runs on, and November's Leftover is the Overview's R$ 1.517,25. */
function commitments(from, today) {
  const current = from === today.slice(0, 7);
  const day = current ? Number(today.slice(8)) : 30;
  const income = 1_250_000;
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(from, i);
    const next = addMonths(month, 1);
    const itau = 94_166;
    const nubank = i === 0 ? 241_822 : i === 2 ? 416_300 - itau : 453_300 + 4_000 * i - itau;
    const otherBills = i === 0
      ? BILLS.map((b, n) => ({ id: b.id, name: b.name, cents: b.expectedCents, paid: n === 0 }))
      : [{ id: "b1", name: "Aluguel", cents: 350_000, paid: false }, { id: "b5", name: "Contas da casa", cents: 15_480, paid: false }, ...(i === 2 ? [{ id: "b6", name: "IPVA", cents: 358_220, paid: false }] : [])];
    const planned = i === 0 ? 244_702 : 220_000;
    const savingCents = 120_000;
    const cardsCents = nubank + itau;
    const billsCents = otherBills.reduce((sum, b) => sum + b.cents, 0);
    const leftoverCents = i === 0 ? 151_725 : income - cardsCents - billsCents - planned - savingCents;
    const pacePlanned = planned + 120_000;
    return {
      month,
      installments: [["Geladeira Frost Free", 3, 10, 32_490], ["Mercado Livre", 6, 10, 23_343], ["Canadian Solar", 5, 12, 162_309]]
        .map(([name, number, total, amountCents]) => ({ name, number: number + i, total, amountCents })).filter((p) => p.number <= p.total),
      cards: [
        { sourceId: "s1", name: "Nubank Ultravioleta", amountCents: nubank, billDaysKnown: true, fromBank: true, dueOn: `${next}-10`, closesOn: `${next}-03` },
        { sourceId: "s3", name: "Itaú Click", amountCents: itau, billDaysKnown: true, fromBank: true, dueOn: `${next}-06`, closesOn: `${month}-28` },
      ],
      otherBills,
      otherInstallmentsCents: 32_490,
      // Eating out is over its plan at the current pace, so the screens show a cut; groceries is at its plan.
      planned: [
        { category: "groceries", cents: planned - 100_000, paceCents: planned - 100_000, limited: true },
        { category: "eating_out", cents: 100_000, paceCents: 220_000, limited: true },
      ],
      plannedCents: planned,
      pacePlannedCents: pacePlanned,
      savingCents,
      totalCents: income - leftoverCents,
      leftoverCents,
      // The Leftover plus the plan, less the pace plan, as the API computes it.
      paceLeftoverCents: leftoverCents + planned - pacePlanned,
      ...(i === 0 && current && { spentOffCardCents: 41_200, dailyAllowanceCents: 7_500 }),
      // The line ends on the sum of the Spending limits (R$ 4.983), which puts day 11 R$ 200 above the spend, as the artboard says.
      ...(i === 0 && { pace: { spentCents: Array.from({ length: day }, (_, d) => PACE_DAYS.slice(0, d + 1).reduce((a, b) => a + b, 0)), lineEndCents: 498_300 } }),
    };
  });
  return { monthlyIncomeCents: income, months };
}

function bills(month, today) {
  const current = month === today.slice(0, 7);
  const list = current ? BILLS : BILLS.slice(0, 1).map((b) => ({ ...b, name: "Aluguel" }));
  return list.map((b, n) => ({
    id: b.id, name: b.name, expectedCents: b.expectedCents, dueDay: b.dueDay, dueDate: `${month}-${pad(b.dueDay)}`,
    ...(current && n === 0 ? { paid: true, paidBy: "hand", paidCents: b.expectedCents } : { paid: false, paidCents: null }),
  }));
}

const daysAgo = (today, days) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** Three items that ran out and four in stock, one always bought and one never bought: both states, both marks. */
function pantry(today) {
  const item = (id, name, over = {}) => ({ id, name, preferredBrand: null, fixed: false, state: "in_stock", ...over });
  return {
    items: [
      item("p1", "Leite", { state: "ran_out", ranOutOn: daysAgo(today, 2) }),
      item("p2", "Café", { state: "ran_out", ranOutOn: daysAgo(today, 5) }),
      item("p3", "Sabão em pó", { state: "ran_out", ranOutOn: daysAgo(today, 9) }),
      item("p4", "Arroz", { preferredBrand: "Tio João", fixed: true, avgDurationDays: 22 }),
      item("p5", "Feijão", { avgDurationDays: 18 }),
      item("p6", "Azeite"),
      item("p7", "Queijo minas", { avgDurationDays: 9 }),
    ],
  };
}

/** The next shopping list as ShoppingList.dc.html has it: priced, unpriced and kg lines, and a groceries limit with room left. */
function shoppingList() {
  const line = (itemId, name, quantityMilli, unit, unitPriceCents, over = {}) => ({
    itemId, name, preferredBrand: null, fixed: false, quantityMilli, unit,
    ...(unitPriceCents === undefined ? {} : { unitPriceCents, priceCents: Math.round((unitPriceCents * quantityMilli) / 1000) }),
    ...over,
  });
  const items = [
    line("p4", "Arroz", 1000, "UN", 2790, { preferredBrand: "Tio João", fixed: true }),
    line("p5", "Feijão", 2000, "UN", 819),
    line("p7", "Queijo minas", 450, "KG", 6490),
    line("p2", "Café", 1000, "UN", 1890),
    line("p8", "Sal", 1000, "UN"),
    line("p9", "Peito de frango", 1234, "KG", 2190),
  ];
  return { items, expectedTotalCents: items.reduce((sum, i) => sum + (i.priceCents ?? 0), 0), groceriesLeftCents: 15_849 };
}

/** One item's detail: six purchases at two stores, newest first, from R$ 24 to R$ 27,90. Prices are per unit. */
function pantryItem(id, today) {
  const row = pantry(today).items.find((i) => i.id === id);
  if (!row) return null;
  const buys = [[9, 2790, "Mercado Bom Preço"], [40, 2490, "Atacadão"], [68, 2650, "Mercado Bom Preço"], [95, 2400, "Atacadão"], [130, 2590, "Mercado Bom Preço"], [160, 2790, "Mercado Bom Preço"]];
  return {
    item: { ...row, lastPriceCents: 2790 },
    avgDurationDays: row.avgDurationDays ?? null,
    prices: buys.map(([days, unitPriceCents, storeName]) => ({ issuedOn: daysAgo(today, days), unitPriceCents, storeName })),
  };
}

/** A receipt read now, with three unmatched lines and one already matched (so the matching step shows "1 de 3"). */
function receipt(today) {
  const line = (n, description, quantityMilli, unit, unitPriceCents, over = {}) => ({
    n, description, quantityMilli, unit, unitPriceCents, totalCents: Math.round((quantityMilli * unitPriceCents) / 1000), itemId: null, ignored: false, ...over,
  });
  const lines = [
    line(1, "ARROZ TIO JOAO T1 5KG", 1000, "UN", 2790),
    line(2, "QJO MINAS FRESCAL KG", 450, "KG", 6490),
    line(3, "LEITE PIRACANJUBA INTEGRAL 1L", 6000, "UN", 549),
    line(4, "FEIJAO CARIOCA 1KG", 1000, "UN", 819, { itemId: "p5" }),
  ];
  return { id: "r1", storeName: "Mercado Bom Preço", issuedOn: today, totalCents: lines.reduce((sum, l) => sum + l.totalCents, 0), readBy: "sefaz", lines };
}

/** Goals.dc.html: R$ 1.200 a month, half to the reserve, the rest split 2 to 1 between the Chile trip and the notebook. */
function savings(today) {
  const month = today.slice(0, 7);
  return {
    reserveTargetCents: 3_000_000, contributionBaseCents: 120_000, reserveSharePercent: 50,
    // One of each: from the bank and picked, edited by the User, and from the bank for the Goals.
    investments: [
      { id: "i1", name: "CDB Nubank Reserva", valueCents: 2_450_000, serves: "reserve", source: "pluggy", reportedByBank: true, edited: false, bankValueCents: 2_450_000 },
      { id: "i2", name: "Tesouro Selic 2029", valueCents: 1_480_000, serves: "goals", source: "pluggy", reportedByBank: true, edited: true, bankValueCents: 1_465_233 },
      { id: "i3", name: "Fundo XP Trend", valueCents: 420_000, serves: "goals", source: "pluggy", reportedByBank: true, edited: false, bankValueCents: 420_000 },
    ],
    reserve: { targetCents: 3_000_000, savedCents: 2_450_000, monthCents: 60_000, expectedMonth: addMonths(month, 9) },
    goals: [
      { id: "g1", name: "Viagem para o Chile", targetCents: 600_000, targetMonth: "2027-06", savedCents: 300_000, monthCents: 40_000, expectedMonth: addMonths(month, 7), late: false },
      { id: "g2", name: "Notebook novo", targetCents: 900_000, targetMonth: "2027-09", savedCents: 200_000, monthCents: 20_000, expectedMonth: addMonths(month, 34), late: true },
    ],
    unassignedCents: 0,
    leftover: { leftoverCents: 151_725, extraCents: 50_000, monthsSooner: 2 },
  };
}

// NetWorth.dc.html's lines, in reais: 30 days ending today, and the 17 points since the first saved balance (12 Sep).
const SERIES_30D = [47120, 47180, 46900, 46950, 47010, 46420, 46480, 46610, 46700, 46820, 46760, 46900, 46980, 47100, 47050, 47200, 47260, 47340, 47410, 47380, 47490, 47560, 47640, 47910, 47850, 48120, 47980, 48050, 48260, 48312.7];
const SERIES_ALL = [44900, 45120, 45300, 45210, 45680, 45900, 46050, 46200, 46380, 46420, 46700, 46900, 47120, 47380, 47640, 48050, 48312.7];

/** Balances plus Investments for the range, ending today; 90d and 1y start on 12 Sep, so the "history starts" note shows on both. */
function netWorth(today, range) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const day = (back) => new Date(end - back * 86_400_000).toISOString().slice(0, 10);
  const vals = range === "30d" || range == null ? SERIES_30D : SERIES_ALL;
  const span = range === "30d" || range == null ? vals.length - 1 : 60;
  return {
    hasData: true,
    today: { totalCents: 4_831_270, balancesCents: 817_258, investmentsCents: 4_350_000, cardBillsCents: 335_988 },
    series: vals.map((v, i) => ({ day: day(Math.round(((vals.length - 1 - i) * span) / (vals.length - 1))), cents: Math.round(v * 100) })),
    seriesExcludesCardBills: true,
    monthStart: { day: new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10), balancesCents: 715_058, investmentsCents: 4_268_800 },
    monthChange: { balancesCents: 102_200, investmentsCents: 81_200, totalCents: 183_400 },
  };
}

/**
 * The `months` months ending at `to`: November as Main.dc.html has it (R$ 9.800 in, R$ 5.127,41 out, R$ 1.200 saved) and October, and the
 * months before it, as the categories' "vs out" deltas imply, each a little less in groceries the further back.
 */
function history(to, months, today) {
  const [y, m] = to.split("-").map(Number);
  const oct = { housing: 350_000, groceries: 66_554, eating_out: 34_366, transport: 22_845, subscriptions: 14_770, health: 7_000, leisure: 21_795, other: 7_420, shopping: 40_000 };
  const nov = { housing: 350_000, groceries: 61_230, eating_out: 38_490, transport: 22_160, subscriptions: 14_770, health: 9_800, leisure: 8_500, other: 7_791 };
  return {
    to,
    months: Array.from({ length: months }, (_, i) => {
      const back = months - 1 - i;
      const index = y * 12 + (m - 1) - back;
      const month = `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
      const current = month === today.slice(0, 7);
      const categories = Object.entries(current ? nov : { ...oct, groceries: oct.groceries - (back - 1) * 3_000 });
      const spentCents = current ? 512_741 : 526_100 - Math.max(0, back - 1) * 3_000;
      return { month, incomeCents: 980_000, spentCents, savedCents: 120_000, categories: categories.map(([category, spentCents]) => ({ category, spentCents })) };
    }),
  };
}

/** Six closed bills of a card, oldest first, as CardBills.dc.html draws them; none for a card without. */
function pastCardBills(sourceId, today) {
  const cards = {
    s1: { closeDay: 3, dueDay: 10, last: 0, totals: [201_000, 238_000, 196_000, 229_000, 210_700, 241_822], averageCents: 220_340 },
    s3: { closeDay: 28, dueDay: 6, last: 1, totals: [118_000, 99_000, 124_000, 87_000, 89_900, 94_166], averageCents: 102_015 },
  };
  const card = cards[sourceId];
  if (!card) return { sourceId, bills: [], averageCents: null };
  const bills = card.totals.map((totalCents, i) => {
    const month = addMonths(today.slice(0, 7), i - 5 - card.last);
    return { closesOn: `${month}-${pad(card.closeDay)}`, dueOn: `${card.dueDay < card.closeDay ? addMonths(month, 1) : month}-${pad(card.dueDay)}`, totalCents };
  });
  return { sourceId, bills, averageCents: card.averageCents };
}

/** The answer to a request, or null when there is no fake for it. `today` is `YYYY-MM-DD`. */
export function answer(method, url, today = TODAY) {
  const params = url.searchParams;
  const route = `${method} ${url.pathname}`;
  if (route === "GET /me/finance") return { status: 200, body: { configured: true, sources: SOURCES.map((s) => (s.id in BALANCES ? { ...s, balanceCents: BALANCES[s.id], balanceOn: today } : s)), items: ITEMS, lastSyncedAt: hoursBeforeMidday(today, 2) } };
  if (route === "GET /me/finance/manual-cards") return { status: 200, body: { cards: [] } };
  if (route === "GET /me/finance/transactions") return { status: 200, body: transactions(params.get("month")) };
  if (route === "GET /me/finance/history") return { status: 200, body: history(params.get("to"), Number(params.get("months")), today) };
  if (route === "GET /me/finance/commitments") return { status: 200, body: commitments(params.get("from"), today) };
  if (route === "GET /me/finance/card-bills") return { status: 200, body: pastCardBills(params.get("source"), today) };
  if (route === "GET /me/finance/bills") return { status: 200, body: bills(params.get("month"), today) };
  if (route === "GET /me/finance/bill-suggestions") return { status: 200, body: [{ merchantKey: "spotify", name: "Spotify", amountCents: 2_190, dueDay: 6 }, { merchantKey: "netflix", name: "Netflix", amountCents: 4_490, dueDay: 9 }] };
  if (route === "GET /me/finance/pantry") return { status: 200, body: pantry(today) };
  if (route === "GET /me/finance/pantry/list") return { status: 200, body: shoppingList() };
  if (/^PUT \/me\/finance\/pantry\/list\/[^/]+$/.test(route)) return { status: 204, body: {} };
  const itemRead = /^GET \/me\/finance\/pantry\/items\/([^/]+)$/.exec(route);
  if (itemRead) {
    const body = pantryItem(decodeURIComponent(itemRead[1]), today);
    return body ? { status: 200, body } : { status: 404, body: { error: "not_found" } };
  }
  if (route === "POST /me/finance/pantry/receipts") return { status: 201, body: receipt(today) };
  if (route === "POST /me/finance/pantry/receipts/photo") {
    const { storeName, issuedOn, totalCents, lines } = receipt(today);
    const draftLines = lines.map(({ description, quantityMilli, unit, unitPriceCents, totalCents: lineTotal }) => ({ description, quantityMilli, unit, unitPriceCents, totalCents: lineTotal }));
    return { status: 200, body: { draft: { storeName, storeCnpj: "", accessKey: "", issuedOn, totalCents, lines: draftLines } } };
  }
  if (/^PUT \/me\/finance\/pantry\/receipts\/r1\/lines\/\d+$/.test(route)) return { status: 200, body: receipt(today) };
  if (route === "GET /me/finance/net-worth") return { status: 200, body: netWorth(today, params.get("range")) };
  if (route === "GET /me/finance/savings") return { status: 200, body: savings(today) };
  return null;
}
