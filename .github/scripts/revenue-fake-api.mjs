// The API answers Revenue's screenshots are taken against: one plausible household, dated in the month asked for.
// A screen that reads a new endpoint adds its answer here, or revenue-screenshots.mjs fails naming the request.

const DESCRIPTIONS = [
  ["Supermercado Pão de Açúcar Vila Mariana", -28_740, "expense", "groceries", "Nubank"],
  ["Salário", 1_250_000, "income", null, "Itaú"],
  ["iFood *Restaurante Japonês Sushi Yassu Liberdade", -8_990, "expense", "eating_out", "Nubank"],
  ["Uber *Trip", -2_350, "expense", "transport", "Nubank"],
  ["Conta de luz Enel", -21_480, "expense", "household_bills", "Itaú"],
  ["Farmácia Drogasil", -6_420, "expense", "health", "Nubank"],
  ["Transferência para poupança", -50_000, "saving", null, "Itaú"],
  ["Netflix.com", -5_590, "expense", "subscriptions", "Nubank"],
  ["Pix recebido de Maria Silva", 15_000, "transfer", null, "Itaú"],
  ["Petz Pet Shop", -12_990, "expense", "pets", "Nubank"],
];

const SOURCES = [
  { id: "s1", name: "Nubank", bankName: "Nubank", kind: "credit_card", currency: "BRL", closeDay: 8, dueDay: 15 },
  { id: "s3", name: "Itaú Visa", bankName: "Itaú", kind: "credit_card", currency: "BRL", closeDay: null, dueDay: null },
  { id: "s2", name: "Itaú", bankName: "Itaú", kind: "checking", currency: "BRL", closeDay: null, dueDay: null },
];
const SOURCE_ID = { Nubank: "s1", Itaú: "s2" };

const pad = (n) => String(n).padStart(2, "0");

/** The days of `month` the rows fall on: up to today in the current month, so nothing is dated in the future. */
function days(month, today) {
  const last = month === today.slice(0, 7) ? Number(today.slice(8)) : 28;
  return DESCRIPTIONS.map((_, i) => `${month}-${pad(Math.max(1, last - i))}`);
}

function transactions(month, today) {
  const on = days(month, today);
  const rows = DESCRIPTIONS.map(([description, amountCents, type, spendingCategory, sourceName], i) => ({
    id: `t${i + 1}`, sourceId: SOURCE_ID[sourceName], postedOn: on[i], countsOn: on[i], description, sourceName, amountCents, currency: "BRL", type, spendingCategory,
    installment: null,
  }));
  rows.push({
    id: "t11", sourceId: "s1", postedOn: on[0], countsOn: on[0], description: "Magazine Luiza Geladeira Frost Free", sourceName: "Nubank",
    amountCents: -32_490, currency: "BRL", type: "expense", spendingCategory: "shopping", installment: { number: 3, total: 10 },
  });
  rows.push({
    id: "t12", postedOn: on[1], countsOn: on[1], description: "PIX Pagamento 8841", sourceName: "Itaú",
    amountCents: -4_500, currency: "BRL", type: "expense", spendingCategory: "other", categorySetBy: "fallback", installment: null,
  });
  rows.sort((a, b) => b.postedOn.localeCompare(a.postedOn));
  const expenses = rows.filter((t) => t.type === "expense");
  const byCategory = {};
  for (const t of expenses) byCategory[t.spendingCategory] = (byCategory[t.spendingCategory] ?? 0) - t.amountCents;
  return {
    month,
    spentCents: expenses.reduce((sum, t) => sum - t.amountCents, 0),
    categories: Object.entries(byCategory).map(([category, spentCents]) => ({ category, spentCents })),
    limits: { groceries: 40_000, eating_out: 5_000 },
    transactions: rows,
  };
}

function commitments(from, today) {
  const current = from === today.slice(0, 7);
  const day = current ? Number(today.slice(8)) : 30;
  return {
    monthlyIncomeCents: 1_250_000,
    months: [{
      month: from,
      cards: [
        { sourceId: "s1", name: "Nubank", amountCents: 284_300, billDaysKnown: true, fromBank: true, dueOn: `${from}-15`, closesOn: `${from}-08` },
        { sourceId: "s3", name: "Itaú Visa", amountCents: 50_000, billDaysKnown: false, fromBank: false, dueOn: null, closesOn: null },
      ],
      otherBills: [
        { id: "b1", name: "Aluguel", cents: 320_000, paid: true },
        { id: "b2", name: "Internet Vivo Fibra", cents: 12_990, paid: false },
      ],
      otherInstallmentsCents: 32_490,
      planned: [{ category: "groceries", cents: 120_000 }],
      plannedCents: 120_000,
      totalCents: 769_780,
      leftoverCents: 300_000,
      ...(current && { spentOffCardCents: 41_200, savingCents: 50_000, dailyAllowanceCents: 9_500 }),
      pace: { spentCents: Array.from({ length: day }, (_, i) => (i + 1) * 21_000), lineEndCents: 950_000 },
    }],
  };
}

function bills(month) {
  return [
    { id: "b1", name: "Aluguel", expectedCents: 320_000, dueDay: 5, dueDate: `${month}-05`, paid: true, paidBy: "hand", paidCents: 320_000 },
    { id: "b2", name: "Internet Vivo Fibra", expectedCents: 12_990, dueDay: 15, dueDate: `${month}-15`, paid: false, paidCents: null },
    { id: "b3", name: "Condomínio", expectedCents: 85_000, dueDay: 25, dueDate: `${month}-25`, paid: false, paidCents: null },
  ];
}

function savings(today) {
  const month = (n) => {
    const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  return {
    reserveTargetCents: 3_000_000, contributionBaseCents: 150_000, reserveSharePercent: 40,
    investments: [{ id: "i1", name: "Tesouro Selic", valueCents: 1_200_000, serves: "reserve", source: "manual", edited: false }],
    reserve: { targetCents: 3_000_000, savedCents: 1_200_000, monthCents: 60_000, expectedMonth: month(30) },
    goals: [
      { id: "g1", name: "Viagem para a Europa", targetCents: 1_800_000, targetMonth: month(14), savedCents: 450_000, monthCents: 90_000, expectedMonth: month(15), late: true },
      { id: "g2", name: "Reforma da cozinha", targetCents: 2_500_000, targetMonth: null, savedCents: 300_000, monthCents: 0, expectedMonth: month(60), late: false },
    ],
    unassignedCents: 0,
  };
}

/** Balances plus Investments for the range, ending today; the 1y range starts mid-way so the "history starts" note shows. */
function netWorth(today, range) {
  const days = { "30d": 30, "90d": 90, "1y": 200 }[range] ?? 30;
  const end = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return {
    hasData: true,
    today: { totalCents: 1_850_000, balancesCents: 650_000, investmentsCents: 1_350_000, cardBillsCents: 150_000 },
    series: Array.from({ length: days }, (_, i) => ({
      day: new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
      cents: 1_700_000 + i * (300_000 / days) + (i % 7) * 12_000,
    })).map((p) => ({ ...p, cents: Math.round(p.cents) })),
    seriesExcludesCardBills: true,
  };
}

/** The six months ending at `to`, each with a little less spent in groceries the further back it goes. */
function history(to, months) {
  const [y, m] = to.split("-").map(Number);
  return {
    to,
    months: Array.from({ length: months }, (_, i) => {
      const index = y * 12 + (m - 1) - (months - 1 - i);
      const month = `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
      const groceries = 28_740 + (i - months + 1) * 3_000;
      return { month, spentCents: groceries + 8_990, categories: [{ category: "groceries", spentCents: groceries }, { category: "eating_out", spentCents: 8_990 }] };
    }),
  };
}

/** The answer to a request, or null when there is no fake for it. `today` is `YYYY-MM-DD`. */
export function answer(method, url, today) {
  const params = url.searchParams;
  const route = `${method} ${url.pathname}`;
  if (route === "GET /me/finance") return { status: 200, body: { sources: SOURCES } };
  if (route === "GET /me/finance/transactions") return { status: 200, body: transactions(params.get("month"), today) };
  if (route === "GET /me/finance/history") return { status: 200, body: history(params.get("to"), Number(params.get("months"))) };
  if (route === "GET /me/finance/commitments") return { status: 200, body: commitments(params.get("from"), today) };
  if (route === "GET /me/finance/bills") return { status: 200, body: bills(params.get("month")) };
  if (route === "GET /me/finance/bill-suggestions") return { status: 200, body: [{ merchantKey: "enel", name: "Conta de luz Enel", amountCents: 21_480, dueDay: 10 }] };
  if (route === "GET /me/finance/net-worth") return { status: 200, body: netWorth(today, params.get("range")) };
  if (route === "GET /me/finance/savings") return { status: 200, body: savings(today) };
  return null;
}
