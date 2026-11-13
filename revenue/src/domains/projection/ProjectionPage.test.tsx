import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "../overview/api/api";
import type { CommitmentMonth, Commitments } from "../overview/api/api";
import { ProjectionPage } from "./ProjectionPage";

vi.mock("../overview/api/api", async (original) => ({ ...(await original<typeof import("../overview/api/api")>()), getCommitments: vi.fn() }));

const month = (n: number, change: Partial<CommitmentMonth> = {}): CommitmentMonth => ({
  month: `2030-${String(n).padStart(2, "0")}`,
  installments: [], cards: [{ sourceId: "s1", name: "Nubank", amountCents: 100000, billDaysKnown: true }],
  otherBills: [{ id: "b1", name: "Aluguel", cents: 200000, paid: false }], otherInstallmentsCents: 0,
  planned: [{ category: "groceries", cents: 30000 }], plannedCents: 30000, savingCents: 50000,
  totalCents: 380000, leftoverCents: 120000, ...change,
});
const MONTHS = Array.from({ length: 12 }, (_, i) => month(i + 1));
const DATA: Commitments = { monthlyIncomeCents: 500000, months: MONTHS };
const OVER: Commitments = { ...DATA, months: MONTHS.map((m, i) => (i === 2 ? { ...m, totalCents: 550000, leftoverCents: -50000 } : m)) };
const NO_INCOME: Commitments = { monthlyIncomeCents: null, months: MONTHS.map(({ leftoverCents, ...m }) => m) };
const PLANS: Commitments = { ...DATA, months: [month(1, { installments: [{ name: "Geladeira", number: 2, total: 4, amountCents: 30000 }] }), ...MONTHS.slice(1)] };
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<ProjectionPage />, { path: "/projection", locale: "en", ...options });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  localStorage.clear();
  vi.mocked(api.getCommitments).mockReset();
  vi.mocked(api.getCommitments).mockResolvedValue(DATA);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the months", () => {
  it("asks from this month in São Paulo", async () => {
    open();
    await screen.findByText("January 2030");
    expect(api.getCommitments).toHaveBeenCalledWith("2030-01");
  });

  it("on a phone shows twelve month cards, the current one open, each with its Total and Leftover", async () => {
    open();
    const cards = await screen.findAllByRole("group");
    expect(cards).toHaveLength(12);
    expect(screen.getByText("January 2030").closest("details")!.open).toBe(true);
    expect(screen.getByText("February 2030").closest("details")!.open).toBe(false);
    expect(cards[0]!.textContent).toContain("R$3,800.00");
    expect(cards[0]!.textContent).toContain("R$1,200.00");
  });

  it("opens a month to list its groups and lines as the API gives them", async () => {
    open();
    await userEvent.click(await screen.findByText("March 2030"));
    const card = screen.getByText("March 2030").closest("details")!;
    expect(card.open).toBe(true);
    for (const text of ["Card bills", "Nubank", "R$1,000.00", "Other bills", "Aluguel", "R$2,000.00", "Planned spending", "Groceries", "Put aside", "R$500.00", "Monthly income"]) {
      expect(card.textContent).toContain(text);
    }
  });

  it("on a desktop width is one table of twelve months against the groups, Total and Leftover", async () => {
    width(true);
    open();
    const table = await screen.findByRole("table", { name: "Coming months" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(13);
    for (const label of ["Card bills", "Other bills", "Planned spending", "Put aside", "Total", "Leftover"]) {
      expect(within(table).getByRole("rowheader", { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole("group")).toBeNull();
  });
});

describe("a negative Leftover", () => {
  it.each([false, true])("has a minus sign and words, never alarm styling (desktop %s)", async (desktop) => {
    width(desktop);
    vi.mocked(api.getCommitments).mockResolvedValue(OVER);
    const view = open();
    expect(await screen.findByText("R$500.00 short")).toBeTruthy();
    expect(view.container.textContent).toContain("-R$500.00");
    expect(view.container.innerHTML).not.toMatch(/danger|alert|negative/);
  });

  it("says nothing of shortage when no month is over", async () => {
    open();
    await screen.findByText("January 2030");
    expect(screen.queryByText(/short/)).toBeNull();
  });
});

describe("income", () => {
  it("without income there is no Leftover and a link to Settings", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue(NO_INCOME);
    open();
    const link = await screen.findByRole("link", { name: "Set monthly income" });
    expect(link.getAttribute("href")).toBe("/settings");
    expect(screen.queryByText(/Leftover/)).toBeNull();
  });

  it("with income there is no such link", async () => {
    open();
    await screen.findByText("January 2030");
    expect(screen.queryByRole("link", { name: "Set monthly income" })).toBeNull();
  });
});

describe("installment plans in progress", () => {
  it("lists a plan under the months with where it stands and when it ends", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue(PLANS);
    open();
    const section = await screen.findByRole("region", { name: "Installments in progress" });
    expect(section.textContent).toContain("Geladeira");
    expect(section.textContent).toContain("R$300.00/month");
    expect(section.textContent).toContain("next 2 of 4 · last in March 2030");
  });

  it("shows none without plans", async () => {
    open();
    await screen.findByText("January 2030");
    expect(screen.queryByRole("region", { name: "Installments in progress" })).toBeNull();
  });
});

describe("states", () => {
  it("offers a retry when the read fails", async () => {
    vi.mocked(api.getCommitments).mockRejectedValueOnce(new Error("x"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("January 2030")).toBeTruthy();
  });

  it("speaks pt-BR", async () => {
    open({ locale: "pt-BR" });
    await waitFor(() => expect(screen.getByText("Janeiro de 2030")).toBeTruthy());
    expect(screen.getByRole("heading", { level: 1, name: "Projeção" })).toBeTruthy();
  });
});

describe("accessibility", () => {
  const violations = async () =>
    (await axe.run(document.body, AXE)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  describe.each([["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const)("%s %s", (theme, locale) => {
    it.each([true, false])("screen with a negative Leftover and plans, desktop %s", async (desktop) => {
      width(desktop);
      vi.mocked(api.getCommitments).mockResolvedValue({ ...OVER, months: [PLANS.months[0]!, ...OVER.months.slice(1)] });
      open({ theme, locale });
      await screen.findByText(/short|Faltam/);
      expect(await violations()).toEqual([]);
    });
    it("screen without income", async () => {
      vi.mocked(api.getCommitments).mockResolvedValue(NO_INCOME);
      open({ theme, locale });
      await screen.findByRole("link");
      expect(await violations()).toEqual([]);
    });
  });
});
