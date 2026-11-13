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

const pad = (n) => String(n).padStart(2, "0");

/** The days of `month` the rows fall on: up to today in the current month, so nothing is dated in the future. */
function days(month, today) {
  const last = month === today.slice(0, 7) ? Number(today.slice(8)) : 28;
  return DESCRIPTIONS.map((_, i) => `${month}-${pad(Math.max(1, last - i))}`);
}

function transactions(month, today) {
  const on = days(month, today);
  const rows = DESCRIPTIONS.map(([description, amountCents, type, spendingCategory, sourceName], i) => ({
    id: `t${i + 1}`, postedOn: on[i], countsOn: on[i], description, sourceName, amountCents, currency: "BRL", type, spendingCategory,
    installment: null,
  }));
  rows.push({
    id: "t11", postedOn: on[0], countsOn: on[0], description: "Magazine Luiza Geladeira Frost Free", sourceName: "Nubank",
    amountCents: -32_490, currency: "BRL", type: "expense", spendingCategory: "shopping", installment: { number: 3, total: 10 },
  });
  rows.sort((a, b) => b.postedOn.localeCompare(a.postedOn));
  const expenses = rows.filter((t) => t.type === "expense");
  const byCategory = {};
  for (const t of expenses) byCategory[t.spendingCategory] = (byCategory[t.spendingCategory] ?? 0) - t.amountCents;
  return {
    month,
    spentCents: expenses.reduce((sum, t) => sum - t.amountCents, 0),
    categories: Object.entries(byCategory).map(([category, spentCents]) => ({ category, spentCents })),
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
      cards: [{ sourceId: "s1", name: "Nubank", amountCents: 284_300, billDaysKnown: true }],
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

/** The answer to a request, or null when there is no fake for it. `today` is `YYYY-MM-DD`. */
export function answer(method, url, today) {
  const params = url.searchParams;
  const route = `${method} ${url.pathname}`;
  if (route === "GET /me/finance") return { status: 200, body: {} };
  if (route === "GET /me/finance/transactions") return { status: 200, body: transactions(params.get("month"), today) };
  if (route === "GET /me/finance/commitments") return { status: 200, body: commitments(params.get("from"), today) };
  if (route === "GET /me/finance/bills") return { status: 200, body: bills(params.get("month")) };
  if (route === "GET /me/finance/bill-suggestions") return { status: 200, body: [{ merchantKey: "enel", name: "Conta de luz Enel", amountCents: 21_480, dueDay: 10 }] };
  return null;
}
