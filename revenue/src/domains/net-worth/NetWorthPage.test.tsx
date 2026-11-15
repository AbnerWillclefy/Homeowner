import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import { HIDE_VALUES_STORAGE_KEY, HideValuesProvider } from "../../shared/HideValues";
import * as goalsApi from "../goals/api";
import * as sourcesApi from "../sources/api";
import * as api from "./api";
import type { NetWorth } from "./api";
import { NetWorthPage } from "./NetWorthPage";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getNetWorth: vi.fn() }));
vi.mock("../goals/api", async (original) => ({ ...(await original<typeof import("../goals/api")>()), getSavings: vi.fn() }));
vi.mock("../sources/api", async (original) => ({ ...(await original<typeof import("../sources/api")>()), getSources: vi.fn() }));

const DATA: NetWorth = {
  hasData: true,
  today: { totalCents: 1_000_000, balancesCents: 600_000, investmentsCents: 500_000, cardBillsCents: 100_000 },
  series: [{ day: "2030-01-09", cents: 1_050_000 }, { day: "2030-01-10", cents: 1_100_000 }],
  seriesExcludesCardBills: true,
  monthStart: { day: "2029-12-31", balancesCents: 580_000, investmentsCents: 450_000 },
  monthChange: { balancesCents: 20_000, investmentsCents: 50_000, totalCents: 70_000 },
};
const NONE: NetWorth = { hasData: false, today: null, series: [], seriesExcludesCardBills: true };
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const full = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2030-01-${String(i + 1).padStart(2, "0")}`, cents: 1000 + i }));

const SAVINGS = { investments: [{ name: "Tesouro Selic" }, { name: "CDB Azul" }] } as unknown as goalsApi.Savings;
const src = (name: string, kind: string) => ({ id: name, name, bankName: name, kind, currency: "BRL", closeDay: null, dueDay: null });
const SOURCES: sourcesApi.SourcesStatus = { sources: [src("Itaú", "checking"), src("Nubank", "checking"), src("Nubank Card", "credit_card")], items: [], importing: false, lastSyncedAt: null };

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(<HideValuesProvider><NetWorthPage /></HideValuesProvider>, { path: "/net-worth", locale: "en", ...options });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getNetWorth).mockReset();
  vi.mocked(api.getNetWorth).mockResolvedValue(DATA);
  vi.mocked(goalsApi.getSavings).mockResolvedValue(SAVINGS);
  vi.mocked(sourcesApi.getSources).mockResolvedValue(SOURCES);
});

describe("the screen", () => {
  it("has the header with the subtitle and the hide-values toggle, and no month select", async () => {
    open();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Net worth");
    expect(screen.getByText("Balances and investments, minus unpaid card bills")).toBeTruthy();
    expect(screen.getByRole("button", { name: /hide/i })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows the total once as the hero and the three parts in the two cards, adding up to it", async () => {
    open();
    expect(await screen.findAllByText("R$10,000.00")).toHaveLength(2); // the hero and the sum line
    const how = screen.getByRole("region", { name: "How the number is made" });
    const lines = within(how).getAllByText(/R\$/).map((n) => n.textContent);
    expect(lines).toEqual(["R$6,000.00", "R$5,000.00", "R$1,000.00", "R$10,000.00"]);
    expect(6_000_00 + 5_000_00 - 1_000_00).toBe(DATA.today!.totalCents);
    const from = screen.getByRole("region", { name: "Where it comes from" });
    expect(within(from).getByRole("img", { name: /Investments R\$5,000\.00, accounts R\$6,000\.00, unpaid card bills -R\$1,000\.00/ })).toBeTruthy();
    const rows = within(from).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/goals", "/sources", "/card-bills"]);
    expect(rows[2]!.textContent).toContain("-R$1,000.00");
  });

  it("gives Investments and Accounts a change this month, and card bills none", async () => {
    open();
    const [inv, acc, bills] = within(await screen.findByRole("region", { name: "Where it comes from" })).getAllByRole("link");
    expect(inv!.textContent).toContain("+R$500.00 this month");
    expect(acc!.textContent).toContain("+R$200.00 this month");
    expect(bills!.textContent).not.toContain("this month");
  });

  it("without month data shows no month badges and still renders", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue({ ...DATA, monthStart: null, monthChange: null });
    open();
    const from = await screen.findByRole("region", { name: "Where it comes from" });
    expect(within(from).getAllByRole("link")).toHaveLength(3);
    expect(from.textContent).not.toContain("this month");
  });

  it("names the rows from the savings and the sources, each on its own", async () => {
    open();
    const [inv, acc, bills] = within(await screen.findByRole("region", { name: "Where it comes from" })).getAllByRole("link");
    await waitFor(() => expect(inv!.textContent).toContain("2 investments · Tesouro Selic, CDB Azul"));
    expect(acc!.textContent).toContain("Itaú, Nubank");
    expect(bills!.textContent).toContain("Nubank Card");
  });

  it("keeps the screen when the rows' names fail to load", async () => {
    vi.mocked(goalsApi.getSavings).mockRejectedValue(new Error("x"));
    vi.mocked(sourcesApi.getSources).mockRejectedValue(new Error("x"));
    open();
    const [inv, acc] = within(await screen.findByRole("region", { name: "Where it comes from" })).getAllByRole("link");
    expect(inv!.textContent).toContain("R$5,000.00");
    expect(acc!.textContent).toContain("R$6,000.00");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("reads the series change next to the chart with its basis, not as the change of the total", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue({ ...DATA, series: full(30).map((p, i) => ({ ...p, cents: i === 0 ? 1_050_000 : i === 29 ? 1_100_000 : p.cents })) });
    open();
    const change = await screen.findByText("+R$500.00 · +4.8%");
    expect(change.parentElement!.textContent).toContain("Balances + investments, without card bills");
    expect(screen.getByText("Last 30 days")).toBeTruthy();
  });

  it("shows no percent when the first point is zero", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue({ ...DATA, series: [{ day: "2030-01-09", cents: 0 }, { day: "2030-01-10", cents: 50_000 }] });
    open();
    expect(await screen.findByText("+R$500.00")).toBeTruthy();
  });

  it("hides every amount, the chart's too, while values are hidden", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    const { container } = open();
    await screen.findByRole("region", { name: "Where it comes from" });
    expect(container.textContent).not.toMatch(/R\$\s?\d/);
    expect(container.textContent).not.toMatch(/\d+,\d{3}/);
    expect(screen.getAllByRole("img", { name: /hidden value/ })).toHaveLength(2);
  });

  it("labels the line as balances plus Investments without card bills, and says what the gap to the headline is", async () => {
    open();
    expect((await screen.findByRole("img", { name: /Balances \+ investments, without card bills/ })).getAttribute("aria-label")).toContain("R$11,000.00");
    expect(screen.getByText(/last point.*card bills.*R\$1,000\.00/i)).toBeTruthy();
  });

  it("holds the series in a table", async () => {
    open();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(table.textContent).toContain("R$10,500.00");
    expect(table.textContent).toContain("R$11,000.00");
  });

  it("asks for 30 days first, and a range change reads again", async () => {
    open();
    await screen.findByRole("region", { name: "How the number is made" });
    expect(api.getNetWorth).toHaveBeenLastCalledWith("30d");
    const group = screen.getByRole("radiogroup", { name: "Range" });
    expect(within(group).getByRole("radio", { name: "30 days" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(within(group).getByRole("radio", { name: "1 year" }));
    await waitFor(() => expect(api.getNetWorth).toHaveBeenLastCalledWith("1y"));
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 year" }));
  });

  it("keeps the range in the URL", async () => {
    open({ path: "/net-worth?range=90d" });
    await waitFor(() => expect(api.getNetWorth).toHaveBeenCalledWith("90d"));
  });

  it("with no data shows the history note and no chart or zero", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue(NONE);
    open();
    expect(await screen.findByText(/history starts at your first sync/i)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/R\$0\.00/)).toBeNull();
  });

  it("with a series shorter than the range, draws the points it has and notes the start", async () => {
    open();
    expect(await screen.findByText(/history starts at your first sync/i)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Balances/ })).toBeTruthy();
  });

  it("with a full series, shows no start note", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue({ ...DATA, series: full(30) });
    open();
    await screen.findByRole("img", { name: /Balances/ });
    expect(screen.queryByText(/history starts/i)).toBeNull();
  });

  it("while a longer range loads, does not call the old series short", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValueOnce({ ...DATA, series: full(30) });
    open();
    await screen.findByRole("img", { name: /Balances/ });
    vi.mocked(api.getNetWorth).mockReturnValue(new Promise(() => {}));
    await userEvent.click(screen.getByRole("radio", { name: "1 year" }));
    await waitFor(() => expect(api.getNetWorth).toHaveBeenLastCalledWith("1y"));
    expect(screen.queryByText(/history starts/i)).toBeNull();
  });

  it("offers a retry when the read fails", async () => {
    vi.mocked(api.getNetWorth).mockRejectedValueOnce(new Error("x"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("R$10,000.00")).length).toBeGreaterThan(0);
  });

  it("speaks pt-BR", async () => {
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Saldos + investimentos, sem faturas")).toBeTruthy();
  });
});

describe("accessibility", () => {
  const violations = async () =>
    (await axe.run(document.body, AXE)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  describe.each([["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const)("%s %s", (theme, locale) => {
    it("screen with data", async () => {
      open({ theme, locale });
      await screen.findByRole("img", { name: /Saldos|Balances/ });
      expect(await violations()).toEqual([]);
    });
    it("screen without data", async () => {
      vi.mocked(api.getNetWorth).mockResolvedValue(NONE);
      open({ theme, locale });
      await screen.findByText(/histórico começa|history starts/);
      expect(await violations()).toEqual([]);
    });
  });
});
