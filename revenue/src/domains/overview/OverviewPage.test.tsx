import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideValuesProvider, HIDE_VALUES_STORAGE_KEY } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import { OverviewPage } from "./OverviewPage";

type Reply = { status: number; data?: unknown };
const get = vi.fn<(url: string, config?: { params?: Record<string, string> }) => Promise<Reply>>();
const request = vi.fn<(config: { method: string; url: string }) => Promise<Reply>>();
vi.mock("../../api/client", () => ({
  apiClient: {
    get: (url: string, config?: { params?: Record<string, string> }) => get(url, config),
    request: (config: { method: string; url: string }) => request(config),
  },
  NotSignedIn: class NotSignedIn extends Error {},
}));

// 2026-11-13 12:00 in São Paulo; the device clock is not consulted for the day.
const NOW = new Date("2026-11-13T15:00:00Z");

const baseMonth = {
  month: "2026-11", installments: [], cards: [{ sourceId: "c", name: "Nubank", amountCents: 120000, billDaysKnown: true, dueOn: "2026-11-10", closesOn: "2026-11-03" }],
  otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 30000, spentOffCardCents: 10000, savingCents: 0, totalCents: 160000,
};
const withIncome = {
  ...baseMonth, leftoverCents: 240000, dailyAllowanceCents: 15000,
  pace: { spentCents: [1000, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000, 27000, 30000, 33000, 36000], lineEndCents: 160000 },
};
const bill = (id: string, name: string, dueDate: string, expectedCents: number) => ({ id, name, expectedCents, dueDay: Number(dueDate.slice(8)), dueDate, paid: false, paidCents: null });
const luz = bill("b1", "Luz", "2026-11-20", 18000);
const internet = bill("b2", "Internet", "2026-11-15", 12990);
const tx = (id: string, type: string, amountCents: number, spendingCategory: string | null = null) => ({ id, postedOn: "2026-11-05", description: `desc ${id}`, type, amountCents, spendingCategory, categorySetBy: null });
const spending = {
  categories: [{ category: "housing", spentCents: 300000 }, { category: "groceries", spentCents: 60000 }],
  limits: {},
  transactions: [tx("pay", "income", 500000), tx("e1", "expense", -300000, "housing"), tx("e2", "expense", -60000, "groceries")],
};
const month = (m: string, incomeCents: number, spentCents: number, savedCents: number) => ({ month: m, incomeCents, spentCents, savedCents, categories: [] });
const history = { to: "2026-11", months: [month("2026-10", 900000, 500000, 100000), month("2026-11", 980000, 512741, 120000)] };
const netWorth = {
  hasData: true,
  today: { totalCents: 1850000, balancesCents: 650000, investmentsCents: 1350000, cardBillsCents: 150000 },
  series: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10), cents: 1700000 + i * 5000 })),
  seriesExcludesCardBills: true,
  monthStart: { day: "2026-10-31", balancesCents: 600000, investmentsCents: 1250000 },
  monthChange: { balancesCents: 50000, investmentsCents: 100000, totalCents: 150000 },
};
const savings = {
  reserveTargetCents: 3000000, contributionBaseCents: 150000, reserveSharePercent: 40, investments: [], unassignedCents: 0,
  reserve: { targetCents: 3000000, savedCents: 1200000, monthCents: 60000, expectedMonth: "2028-05" },
  goals: [{ id: "g1", name: "Viagem para o Chile", targetCents: 600000, targetMonth: "2027-06", savedCents: 300000, monthCents: 90000, expectedMonth: "2027-06", late: false }],
};

type Overrides = Partial<Record<"commitments" | "bills" | "transactions" | "history" | "netWorth" | "savings", Reply>>;
let bills: ReturnType<typeof bill>[] & { paid?: boolean }[];
function api(o: Overrides = {}) {
  bills = [luz, internet].map((b) => ({ ...b }));
  get.mockImplementation(async (url, config) => {
    if (url === "/me/finance/commitments") return o.commitments ?? { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, month: config?.params?.from }] } };
    if (url === "/me/finance/bills") return o.bills ?? { status: 200, data: bills };
    if (url === "/me/finance/transactions") return o.transactions ?? { status: 200, data: spending };
    if (url === "/me/finance/history") return o.history ?? { status: 200, data: history };
    if (url === "/me/finance/net-worth") return o.netWorth ?? { status: 200, data: netWorth };
    if (url === "/me/finance/savings") return o.savings ?? { status: 200, data: savings };
    return { status: 404 };
  });
  // A paid mark sticks, so the read that follows it agrees.
  request.mockImplementation(async ({ method, url }) => {
    const id = /bills\/([^/]+)\/payments/.exec(url)?.[1];
    for (const b of bills) if (b.id === id) Object.assign(b, { paid: method === "PUT", paidBy: method === "PUT" ? "hand" : null });
    return { status: 204 };
  });
}

const matchMedia = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  get.mockReset();
  request.mockReset();
});

const page = (path = "/", locale: "pt-BR" | "en" = "pt-BR", theme: "light" | "dark" = "light") =>
  renderApp(<HideValuesProvider><OverviewPage /></HideValuesProvider>, { path, locale, theme });

// Skeletons carry the card's heading too, so wait until every read has landed.
const heading = async (name: string | RegExp) => {
  await waitFor(() => expect(document.querySelector("[aria-busy=true]")).toBeNull());
  return screen.getByRole("heading", { level: 2, name });
};

describe("Overview", () => {
  it("lays out the cards on the 12-column grid, five columns left and seven right", async () => {
    matchMedia(true);
    api();
    page();
    const left = (await heading("Você ainda pode gastar")).closest(".desktop\\:col-span-5");
    expect(left).toBeTruthy();
    expect(left!.parentElement!.className).toContain("desktop:grid-cols-12");
    expect((await heading(/^Distribuição dos gastos/)).closest(".desktop\\:col-span-7")).toBeTruthy();
  });

  it("shows the header with the month and today, the month select and the hide-values toggle, and no old month stepper", async () => {
    api();
    page();
    expect(await screen.findByRole("heading", { level: 1, name: "Visão geral" })).toBeTruthy();
    expect(screen.getByText("Novembro de 2026 · hoje, 13 de Nov.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Mês" }).textContent).toContain("Novembro de 2026");
    expect(screen.getByRole("button", { name: "Esconder valores" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Anterior|Próximo/ })).toBeNull();
  });

  it("shows what can still be spent: Leftover plus planned, the per-day line, the pace and the spent against the line", async () => {
    api();
    page();
    await heading("Você ainda pode gastar");
    expect(screen.getByText("No ritmo")).toBeTruthy();
    expect(screen.getByText(/R\$\s2\.700,00/)).toBeTruthy();
    expect(screen.getByText(/por dia até 30 de Nov\./).textContent).toMatch(/R\$\s150,00/);
    expect(screen.getByText("Gastos do mês").parentElement!.textContent).toMatch(/R\$\s360,00.*R\$\s1\.600/);
    expect(screen.getByRole("img", { name: /R\$\s302,07 abaixo do ritmo/ })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Gasto acumulado por dia", hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(14);
    expect(get).toHaveBeenCalledWith("/me/finance/commitments", { params: { from: "2026-11" } });
  });

  it("says over pace when the spending is above the line", async () => {
    api({ commitments: { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, pace: { spentCents: [100000, 150000, 160000], lineEndCents: 160000 } }] } } });
    page();
    expect(await screen.findByText("Acima do ritmo")).toBeTruthy();
  });

  it("shows the result of the month with its parts and the change against the month before", async () => {
    api();
    page();
    await heading("Resultado do mês");
    expect(screen.getByText(/R\$\s3\.472,59/)).toBeTruthy(); // 9.800,00 - 5.127,41 - 1.200,00
    expect(screen.getByText("até hoje")).toBeTruthy();
    expect(screen.getByText("+16% vs out")).toBeTruthy(); // against 3.000,00
    const parts = screen.getByText("Entradas").closest("dl")!;
    expect(parts.textContent).toMatch(/Entradas.*R\$\s9\.800,00.*Saídas.*R\$\s5\.127,41.*Guardado.*R\$\s1\.200,00/);
    expect(get).toHaveBeenCalledWith("/me/finance/history", { params: { to: "2026-11", months: "2" } });
  });

  it("hides the change badge when the previous month has no data", async () => {
    api({ history: { status: 200, data: { to: "2026-11", months: [month("2026-10", 0, 0, 0), month("2026-11", 980000, 512741, 120000)] } } });
    page();
    await heading("Resultado do mês");
    expect(screen.getByText(/R\$\s3\.472,59/)).toBeTruthy();
    expect(screen.queryByText(/ vs /)).toBeNull();
  });

  it("shows the spending split, the net worth with this month's change, the open card bills and the goals", async () => {
    matchMedia(true);
    api();
    page();
    expect(await heading("Distribuição dos gastos · novembro")).toBeTruthy();
    expect(screen.getAllByText("Moradia").length).toBeGreaterThan(0);
    await heading("Patrimônio");
    expect(screen.getByText(/R\$\s18\.500,00/)).toBeTruthy();
    expect(screen.getByText("+8,1%")).toBeTruthy(); // 1.500 of 18.500 at the month's start, not of today's total
    expect(screen.getByText(/em novembro/).textContent).toMatch(/\+R\$\s1\.500,00/);
    await heading("Faturas abertas");
    expect(screen.getByText("fecha 3 de Nov. · vence 10 de Nov.")).toBeTruthy();
    expect((await heading(/^Objetivos/)).textContent).toMatch(/aporte de R\$\s1\.500,00 por mês/);
    expect(screen.getByText("Viagem para o Chile")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Reserva de emergência" })).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText(/jun\/27/)).toBeTruthy();
  });

  it("opens the bills panel from the alert, marks them all paid, and the alert says paid", async () => {
    matchMedia(true);
    api();
    page();
    const alert = await screen.findByRole("button", { name: /2 contas a pagar/ });
    expect(alert.textContent).toMatch(/R\$\s309,90.*a primeira vence em 2 dias/);
    await userEvent.click(alert);
    const panel = await screen.findByRole("dialog", { name: "2 contas a pagar" });
    expect(within(panel).getByText(/R\$\s309,90 · até 20 de Nov\./)).toBeTruthy();
    expect(within(panel).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringContaining("Internet"), expect.stringContaining("Luz")]);
    expect(within(panel).getByText(/não mexe no banco/)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Ver todas as contas" }).getAttribute("href")).toBe("/bills");

    await userEvent.click(within(panel).getByRole("button", { name: "Marcar as 2 como pagas" }));
    expect(await within(panel).findByRole("button", { name: "2 contas pagas · Desfazer" })).toBeTruthy();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "PUT", url: "/me/finance/bills/b1/payments/2026-11" }));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "PUT", url: "/me/finance/bills/b2/payments/2026-11" }));

    await userEvent.click(within(panel).getByRole("button", { name: "Fechar" }));
    expect(await screen.findByRole("button", { name: /Contas do mês pagas/ })).toBeTruthy();
  });

  it("undoes the marks from the panel", async () => {
    matchMedia(true);
    api();
    page();
    await userEvent.click(await screen.findByRole("button", { name: /2 contas a pagar/ }));
    const panel = await screen.findByRole("dialog");
    await userEvent.click(within(panel).getByRole("button", { name: "Marcar as 2 como pagas" }));
    await userEvent.click(await within(panel).findByRole("button", { name: "2 contas pagas · Desfazer" }));
    expect(await within(panel).findByRole("button", { name: "Marcar as 2 como pagas" })).toBeTruthy();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "DELETE", url: "/me/finance/bills/b1/payments/2026-11" }));
  });

  it("calls a past-due unpaid bill overdue in the panel and the alert", async () => {
    api({ bills: { status: 200, data: [bill("b1", "Luz", "2026-11-05", 18000)] } });
    page();
    const alert = await screen.findByRole("button", { name: /1 conta a pagar/ });
    expect(alert.textContent).toMatch(/a primeira venceu em 5 de Nov\./);
    await userEvent.click(alert);
    expect(await screen.findByText(/Venceu em 5 de Nov\./)).toBeTruthy();
  });

  it("says when there are no bills this month", async () => {
    api({ bills: { status: 200, data: [] } });
    page();
    expect(await screen.findByText("Nenhuma conta a pagar neste mês.")).toBeTruthy();
  });

  it("shows no allowance without income, and invites setting one at /settings", async () => {
    api({ commitments: { status: 200, data: { monthlyIncomeCents: null, months: [baseMonth] } } });
    page();
    const invite = await screen.findByRole("link", { name: "Informar renda" });
    expect(invite.getAttribute("href")).toBe("/settings");
    expect(screen.queryByText("Você ainda pode gastar")).toBeNull();
    expect(screen.queryByRole("img", { name: /ritmo/ })).toBeNull();
  });

  it("reads a past month whole: no today, no allowance, no pace verdict", async () => {
    const pace = { spentCents: Array.from({ length: 31 }, (_, i) => (i + 1) * 100), lineEndCents: 4000 };
    api({ commitments: { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, month: "2026-10", dailyAllowanceCents: undefined, pace }] } } });
    page("/?month=2026-10");
    expect(await heading("Gasto no mês")).toBeTruthy();
    expect(screen.getByText("Outubro de 2026", { selector: "p" })).toBeTruthy();
    expect(screen.queryByText(/hoje/)).toBeNull();
    expect(screen.queryByText(/por dia até/)).toBeNull();
    expect(screen.queryByText(/ritmo/)).toBeNull();
    expect(get).toHaveBeenCalledWith("/me/finance/bills", { params: { month: "2026-10" } });
    await userEvent.click(await screen.findByRole("button", { name: /2 contas a pagar/ }));
    expect(screen.queryByRole("button", { name: /Marcar as/ })).toBeNull(); // a past month is read-only
  });

  it("changes the month through the select, which keeps it in the URL", async () => {
    api();
    page();
    await heading("Você ainda pode gastar");
    await userEvent.click(screen.getByRole("combobox", { name: "Mês" }));
    await userEvent.click(await screen.findByRole("option", { name: "Outubro de 2026" }));
    expect(await screen.findByText("Outubro de 2026", { selector: "p" })).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/me/finance/transactions", { params: { month: "2026-10" } });
  });

  it("keeps the other cards when the net worth read fails, and retries only that one", async () => {
    matchMedia(true);
    api({ netWorth: { status: 500 } });
    page();
    await heading("Você ainda pode gastar");
    const alert = await screen.findByText("Não deu para carregar o patrimônio.");
    expect(alert.closest("[role=alert]")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Patrimônio" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Tentar de novo" })).toHaveLength(1);
    expect(await heading("Faturas abertas")).toBeTruthy();
    api();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("+8,1%")).toBeTruthy();
    expect(screen.queryByText("Não deu para carregar o patrimônio.")).toBeNull();
  });

  it("shows the month's alert on the hero and the card bills when the commitments fail, and the rest stays", async () => {
    matchMedia(true);
    api({ commitments: { status: 200, data: { months: "x" } } });
    page();
    expect(await screen.findByText("Não deu para carregar o mês.")).toBeTruthy();
    expect(await screen.findByText("Não deu para carregar as faturas.")).toBeTruthy();
    expect(await heading("Resultado do mês")).toBeTruthy();
    expect(screen.queryByText("No ritmo")).toBeNull();
  });

  it("says when the month has nothing", async () => {
    matchMedia(true);
    api({ transactions: { status: 200, data: { categories: [], limits: {}, transactions: [] } }, bills: { status: 200, data: [] } });
    page();
    expect(await screen.findByText("Nada por aqui neste mês")).toBeTruthy();
  });

  it("shows no amount while values are hidden", async () => {
    matchMedia(true);
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    api();
    const { container } = page();
    await heading("Faturas abertas");
    await heading(/^Objetivos/);
    await heading("Patrimônio");
    await screen.findByText("+8,1%");
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toBeTruthy();
    // What assistive tech reads: Bedrock's donut prints its total in an aria-hidden centre that the screen hides with CSS.
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll("[aria-hidden=true]").forEach((el) => el.remove());
    expect(visible.textContent).not.toMatch(/R\$\s?-?\d/);
    expect(screen.getByRole("img", { name: "Abaixo do ritmo" })).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: /2 contas a pagar/ }));
    expect(screen.getByRole("dialog").textContent).not.toMatch(/R\$\s?\d/);
  });

  it("switches one card at a time on a phone, with no goals or card bills", async () => {
    matchMedia(false);
    api();
    page();
    await heading("Você ainda pode gastar");
    expect(screen.getByRole("button", { name: /2 contas a pagar/ })).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "Resumo" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Resultado", "Categorias", "Patrimônio"]);
    expect(screen.getByRole("heading", { level: 2, name: "Resultado do mês" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: /^Distribuição/ })).toBeNull();
    await userEvent.click(within(group).getByRole("radio", { name: "Categorias" }));
    expect(screen.queryByRole("heading", { level: 2, name: "Resultado do mês" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: /^Distribuição dos gastos/ })).toBeTruthy();
    await userEvent.click(within(group).getByRole("radio", { name: "Patrimônio" }));
    expect(screen.getByRole("heading", { level: 2, name: "Patrimônio" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: /^Objetivos/ })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Faturas abertas" })).toBeNull();
  });

  it("keeps the chosen tab when the month changes, and shows a failed read inside the tab", async () => {
    matchMedia(false);
    api({ transactions: { status: 500 } });
    page();
    await heading("Você ainda pode gastar");
    await userEvent.click(screen.getByRole("radio", { name: "Categorias" }));
    expect(await screen.findByText("Não deu para carregar os lançamentos.")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: "Mês" }));
    await userEvent.click(await screen.findByRole("option", { name: "Outubro de 2026" }));
    expect(screen.getByRole("radio", { name: "Categorias" }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows six cards on desktop", async () => {
    matchMedia(true);
    api();
    page();
    await heading("Você ainda pode gastar");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
  });

  it("hides the result lines' amounts on a phone", async () => {
    matchMedia(false);
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    api();
    page();
    await heading("Resultado do mês");
    const parts = screen.getByText("Entradas").closest("dl")!;
    expect(parts.textContent).not.toMatch(/R\$\s?\d/);
  });

  it("has no axe violations on a phone", async () => {
    matchMedia(false);
    api();
    page();
    await heading("Resultado do mês");
    const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(violations).toEqual([]);
  });

  it("speaks English", async () => {
    api();
    page("/", "en");
    expect(await heading("You can still spend")).toBeTruthy();
    expect(screen.getByText("Month result")).toBeTruthy();
    expect(screen.getByRole("img", { name: /under pace/ })).toBeTruthy();
    expect(screen.getByText("+16% vs Oct")).toBeTruthy();
  });

  it("uses the São Paulo day: just after midnight UTC it is still the previous month", async () => {
    vi.setSystemTime(new Date("2026-12-01T01:00:00Z"));
    api();
    page();
    await heading("Você ainda pode gastar");
    expect(get).toHaveBeenCalledWith("/me/finance/commitments", { params: { from: "2026-11" } });
  });

  it.each([
    ["pt-BR", "light"],
    ["pt-BR", "dark"],
    ["en", "light"],
    ["en", "dark"],
  ] as const)("has no axe violations in %s, %s", async (locale, theme) => {
    matchMedia(true);
    api();
    page("/", locale, theme);
    await screen.findByRole("img", { name: /ritmo|pace/ });
    await screen.findByRole("button", { name: /2 contas a pagar|2 bills to pay/ });
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(6));
    const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(violations).toEqual([]);
  });
});
