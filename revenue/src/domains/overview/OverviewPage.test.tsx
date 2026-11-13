import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import { OverviewPage } from "./OverviewPage";

type Reply = { status: number; data?: unknown };
const get = vi.fn<(url: string, config?: { params?: Record<string, string> }) => Promise<Reply>>();
vi.mock("../../api/client", () => ({
  apiClient: { get: (url: string, config?: { params?: Record<string, string> }) => get(url, config) },
  NotSignedIn: class NotSignedIn extends Error {},
}));

// 2026-11-13 12:00 in São Paulo; the device clock is not consulted for the day.
const NOW = new Date("2026-11-13T15:00:00Z");

const baseMonth = {
  month: "2026-11", installments: [], cards: [{ sourceId: "c", name: "Nubank", amountCents: 120000, billDaysKnown: true }],
  otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 30000, spentOffCardCents: 10000, savingCents: 0, totalCents: 160000,
};
const withIncome = {
  ...baseMonth, leftoverCents: 240000, dailyAllowanceCents: 14118,
  pace: { spentCents: [1000, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000, 27000, 30000, 33000, 36000], lineEndCents: 160000 },
};
const bill = { id: "b1", name: "Luz", expectedCents: 18000, dueDay: 20, dueDate: "2026-11-20", paid: false, paidCents: null };
const tx = (id: string, type: string, amountCents: number) => ({ id, postedOn: "2026-11-05", description: `desc ${id}`, sourceName: "Banco", amountCents, type, spendingCategory: null });
const transactions = { month: "2026-11", spentCents: 5000, categories: [], transactions: [tx("pay", "income", 500000), tx("e1", "expense", -5000)] };

type Overrides = { commitments?: Reply; bills?: Reply; transactions?: Reply };
function api(o: Overrides = {}) {
  get.mockImplementation(async (url, config) => {
    if (url === "/me/finance/commitments") {
      return o.commitments ?? { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, month: config?.params?.from }] } };
    }
    if (url === "/me/finance/bills") return o.bills ?? { status: 200, data: [bill] };
    if (url === "/me/finance/transactions") return o.transactions ?? { status: 200, data: transactions };
    return { status: 404 };
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  get.mockReset();
});

const page = (path = "/", locale: "pt-BR" | "en" = "pt-BR", theme: "light" | "dark" = "light") =>
  renderApp(<OverviewPage />, { path, locale, theme });

describe("Overview", () => {
  it("shows the allowance, the leftover and the pace table values for the month", async () => {
    api();
    page();
    expect(await screen.findByText("Pode gastar por dia")).toBeTruthy();
    expect(screen.getByText(/R\$\s141,18/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sobra de Novembro" })).toBeTruthy();
    expect(screen.getAllByText(/R\$\s2\.400,00/).length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "Gasto acumulado por dia", hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(14);
    expect(within(table).getByText(/R\$\s360,00/)).toBeTruthy();
    // 13 days of 30: the line is at 1600 * 12 / 29 = R$ 662,07; 360 is under by 302,07.
    expect(screen.getByRole("img", { name: /R\$\s302,07 abaixo do ritmo/ })).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/me/finance/commitments", { params: { from: "2026-11" } });
  });

  it("speaks English, without commanding", async () => {
    api();
    page("/", "en");
    expect(await screen.findByText("Can spend per day")).toBeTruthy();
    expect(screen.getByRole("img", { name: /under pace/ })).toBeTruthy();
  });

  it("shows no allowance without income, and invites setting one at /settings", async () => {
    api({ commitments: { status: 200, data: { monthlyIncomeCents: null, months: [baseMonth] } } });
    page();
    const invite = await screen.findByRole("link", { name: "Informar renda" });
    expect(invite.getAttribute("href")).toBe("/settings");
    expect(screen.queryByText("Pode gastar por dia")).toBeNull();
    expect(screen.queryByRole("img", { name: /ritmo/ })).toBeNull();
    expect(screen.queryByText(/sobram/)).toBeNull();
  });

  it("reads a past month whole, with no allowance", async () => {
    const pace = { spentCents: Array.from({ length: 31 }, (_, i) => (i + 1) * 100), lineEndCents: 4000 };
    api({ commitments: { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, month: "2026-10", dailyAllowanceCents: undefined, pace }] } } });
    page("/?month=2026-10");
    expect(await screen.findByRole("heading", { name: "Sobra de Outubro" })).toBeTruthy();
    expect(screen.queryByText("Pode gastar por dia")).toBeNull();
    const table = screen.getByRole("table", { name: "Gasto acumulado por dia", hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(32);
    expect(get).toHaveBeenCalledWith("/me/finance/bills", { params: { month: "2026-10" } });
  });

  it("keeps the other blocks when the bills read fails, and retries only that one", async () => {
    api({ bills: { status: 500 } });
    page();
    expect(await screen.findByText("Pode gastar por dia")).toBeTruthy();
    const alert = await screen.findByText("Não deu para ler as contas.");
    expect(alert.closest("[role=alert]")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fora dos totais" })).toBeTruthy();
    api();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Luz")).toBeTruthy();
    expect(screen.queryByText("Não deu para ler as contas.")).toBeNull();
  });

  it("shows one alert with Retry when the month read fails, and the bills stay", async () => {
    api({ commitments: { status: 200, data: { months: "x" } } });
    page();
    expect(await screen.findByText("Não deu para carregar o mês.")).toBeTruthy();
    expect(await screen.findByText("Luz")).toBeTruthy();
    expect(screen.queryByText("Pode gastar por dia")).toBeNull();
  });

  it("lists what is left out of the totals, with counts", async () => {
    api();
    page();
    const button = await screen.findByRole("button", { name: /Receitas/ });
    expect(button.textContent).toMatch(/1 lançamento/);
    await userEvent.click(button);
    expect(screen.getByText("desc pay")).toBeTruthy();
  });

  it("calls a past-due unpaid bill overdue in this month only", async () => {
    api({ bills: { status: 200, data: [{ ...bill, dueDate: "2026-11-05", dueDay: 5 }] } });
    page();
    expect(await screen.findByText(/Venceu em/)).toBeTruthy();
    api({ bills: { status: 200, data: [{ ...bill, dueDate: "2026-10-05", dueDay: 5 }] } });
    page("/?month=2026-10");
    expect((await screen.findAllByText(/Vence /)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Venceu/)).toHaveLength(1);
  });

  it("stays neutral when the month passes the income", async () => {
    api({ commitments: { status: 200, data: { monthlyIncomeCents: 400000, months: [{ ...withIncome, leftoverCents: -50000, dailyAllowanceCents: -2941 }] } } });
    page();
    expect(await screen.findByText("O mês já tem mais que a renda.")).toBeTruthy();
    expect(screen.getByText(/O mês já tem R\$\s200,00 além da renda/)).toBeTruthy();
    expect(screen.getByText(/Com o gasto previsto, faltam R\$\s500,00/)).toBeTruthy();
    expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
  });

  it("says when the month has nothing", async () => {
    api({ transactions: { status: 200, data: { month: "2026-11", spentCents: 0, categories: [], transactions: [] } }, bills: { status: 200, data: [] } });
    page();
    expect(await screen.findByText("Nenhuma conta a pagar neste mês.")).toBeTruthy();
    expect(await screen.findByText("Nada por aqui neste mês")).toBeTruthy();
  });

  it("keeps the month in the URL and steps back and forward", async () => {
    api();
    page();
    await screen.findByText("Pode gastar por dia");
    expect(screen.getByRole("button", { name: /Próximo/ }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /Anterior/ }));
    expect(await screen.findByRole("heading", { name: "Sobra de Outubro" })).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/me/finance/transactions", { params: { month: "2026-10" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Próximo/ }).hasAttribute("disabled")).toBe(false));
  });

  it("uses the São Paulo day: just after midnight UTC it is still the previous month", async () => {
    vi.setSystemTime(new Date("2026-12-01T01:00:00Z"));
    api();
    page();
    await screen.findByRole("heading", { name: "Sobra de Novembro" });
    expect(get).toHaveBeenCalledWith("/me/finance/commitments", { params: { from: "2026-11" } });
  });

  it.each([
    ["pt-BR", "light"],
    ["pt-BR", "dark"],
    ["en", "light"],
    ["en", "dark"],
  ] as const)("has no axe violations in %s, %s", async (locale, theme) => {
    api();
    page("/", locale, theme);
    await screen.findByRole("img", { name: /ritmo|pace/ });
    await screen.findByText("Luz");
    const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(violations).toEqual([]);
  });
});
