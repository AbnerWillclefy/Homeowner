import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { NetWorth } from "./api";
import { NetWorthPage } from "./NetWorthPage";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getNetWorth: vi.fn() }));

const DATA: NetWorth = {
  hasData: true,
  today: { totalCents: 1_000_000, balancesCents: 600_000, investmentsCents: 500_000, cardBillsCents: 100_000 },
  series: [{ day: "2030-01-09", cents: 1_050_000 }, { day: "2030-01-10", cents: 1_100_000 }],
  seriesExcludesCardBills: true,
};
const NONE: NetWorth = { hasData: false, today: null, series: [], seriesExcludesCardBills: true };
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const full = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2030-01-${String(i + 1).padStart(2, "0")}`, cents: 1000 + i }));

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<NetWorthPage />, { path: "/net-worth", locale: "en", ...options });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getNetWorth).mockReset();
  vi.mocked(api.getNetWorth).mockResolvedValue(DATA);
});

describe("the screen", () => {
  it("shows the total and its three parts as the API gives them", async () => {
    open();
    const total = await screen.findByText("R$10,000.00");
    expect(total).toBeTruthy();
    const parts = screen.getByRole("list", { name: "Made up of" });
    expect(parts.textContent).toContain("R$6,000.00");
    expect(parts.textContent).toContain("R$5,000.00");
    expect(within(parts).getByText("− unpaid card bills")).toBeTruthy();
    expect(parts.textContent).toContain("R$1,000.00");
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
    await screen.findByText("R$10,000.00");
    expect(api.getNetWorth).toHaveBeenLastCalledWith("30d");
    const group = screen.getByRole("radiogroup", { name: "Range" });
    expect(within(group).getByRole("radio", { name: "30 days" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(within(group).getByRole("radio", { name: "1 year" }));
    await waitFor(() => expect(api.getNetWorth).toHaveBeenLastCalledWith("1y"));
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
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("with a full series, shows no start note", async () => {
    vi.mocked(api.getNetWorth).mockResolvedValue({ ...DATA, series: full(30) });
    open();
    await screen.findByRole("img");
    expect(screen.queryByText(/history starts/i)).toBeNull();
  });

  it("offers a retry when the read fails", async () => {
    vi.mocked(api.getNetWorth).mockRejectedValueOnce(new Error("x"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("R$10,000.00")).toBeTruthy();
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
      await screen.findByRole("img");
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
