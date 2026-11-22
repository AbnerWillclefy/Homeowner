import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as api from "../overview/api/api";
import type { CommitmentMonth, Commitments } from "../overview/api/api";
import { ProjectionPage } from "./ProjectionPage";

vi.mock("../overview/api/api", async (original) => ({ ...(await original<typeof import("../overview/api/api")>()), getCommitments: vi.fn() }));

const month = (n: number, change: Partial<CommitmentMonth> = {}): CommitmentMonth => ({
  month: `2030-${String(n).padStart(2, "0")}`,
  installments: [], cards: [{ sourceId: "s1", name: "Nubank", amountCents: 100000, billDaysKnown: true }],
  otherBills: [{ id: "b1", name: "Aluguel", cents: 200000, paid: false }], otherInstallmentsCents: 0,
  planned: [
    { category: "eating_out", cents: 100000, paceCents: 220000, limited: true },
    { category: "groceries", cents: 30000, paceCents: 30000, limited: false },
  ],
  plannedCents: 30000, pacePlannedCents: 150000, savingCents: 50000,
  totalCents: 380000, leftoverCents: 120000, paceLeftoverCents: 0, ...change,
});
// The plan and the pace differ every month, so a chart that keeps plotting the plan fails the series tests.
const MONTHS = Array.from({ length: 12 }, (_, i) => month(i + 1, { leftoverCents: 120000 + (i + 1) * 100, paceLeftoverCents: (i + 1) * 1000 }));
const DATA: Commitments = { monthlyIncomeCents: 500000, months: MONTHS };
const OVER: Commitments = { ...DATA, months: MONTHS.map((m, i) => (i === 2 ? { ...m, totalCents: 550000, leftoverCents: -50000, paceLeftoverCents: -90000 } : m)) };
const NO_INCOME: Commitments = { monthlyIncomeCents: null, months: MONTHS.map(({ leftoverCents, paceLeftoverCents, pacePlannedCents, ...m }) => m) };
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

const loaded = () => screen.findAllByText("January 2030");
const bars = () => within(screen.getByRole("region", { name: /Leftover per month|Sobra por mês/ })).getAllByRole("button");
const barNames = () => bars().map((b) => b.getAttribute("aria-label"));
const flat = (el: Element) => el.textContent!.replace(/\s/g, " ");
// A dl row as "label value".
const line = (el: Element) => [...el.children].map((c) => c.textContent).join(" ");

describe("the months", () => {
  it("asks from this month in São Paulo and names the income in the subtitle", async () => {
    open();
    await loaded();
    expect(api.getCommitments).toHaveBeenCalledWith("2030-01");
    expect(screen.getByText("What is left of your R$5,000.00 income over the next 12 months")).toBeTruthy();
  });

  it("on a phone is a list of twelve month buttons and no table", async () => {
    open();
    const list = await screen.findByRole("region", { name: "Coming months" });
    const buttons = within(list).getAllByRole("button");
    expect(buttons).toHaveLength(12);
    expect(buttons[0]!.textContent).toContain("January 2030");
    expect(buttons[0]!.textContent).toContain("Bills and card bills R$3,000.00");
    expect(buttons[0]!.textContent).toContain("R$1,201.00");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("on a desktop is a table of exactly six columns, scrolling sideways only inside its box", async () => {
    width(true);
    open();
    const table = await screen.findByRole("table", { name: "Coming months" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Month", "Bills and card bills", "Planned spending", "Put aside", "Leftover by plan", "Leftover at pace"]);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(12);
    expect(table.parentElement!.className).toContain("overflow-x-auto");
    expect(table.className).not.toContain("min-w-");
    const jan = within(table).getAllByRole("row")[1]!;
    expect(within(jan).getAllByRole("cell").map(flat)).toEqual(["R$3,000.00", "R$300.00", "R$500.00", "R$1,201.00", "R$10.00"]);
  });

  it("speaks pt-BR in the table headers", async () => {
    width(true);
    open({ locale: "pt-BR" });
    const table = await screen.findByRole("table", { name: "Próximos meses" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Mês", "Contas e faturas", "Gasto previsto", "Guardado", "Sobra pelo plano", "Sobra no ritmo"]);
  });
});

describe("the series switch", () => {
  it.each([true, false])("plots the plan at first and the pace once chosen (desktop %s)", async (desktop) => {
    width(desktop);
    open();
    await loaded();
    expect(screen.getByRole("radio", { name: "By plan" }).getAttribute("aria-checked")).toBe("true");
    expect(barNames()).toHaveLength(12);
    expect(barNames().map((n) => n!.split("leftover ")[1])).toEqual(MONTHS.map((m) => `R$${(m.leftoverCents! / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`));
    await userEvent.click(screen.getByRole("radio", { name: "At current pace" }));
    expect(barNames().map((n) => n!.split("leftover ")[1])).toEqual(MONTHS.map((m) => `R$${(m.paceLeftoverCents! / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`));
    expect(barNames()[0]).toBe("January 2030: leftover R$10.00");
  });

  it("changes the big figure and its label with the series, and the phone list with it", async () => {
    open();
    const detail = await screen.findByRole("region", { name: "January 2030" });
    expect(detail.textContent).toContain("R$1,201.00Leftover by plan");
    await userEvent.click(screen.getByRole("radio", { name: "At current pace" }));
    expect(detail.textContent).toContain("R$10.00Leftover at current pace");
    const first = within(screen.getByRole("region", { name: "Coming months" })).getAllByRole("button")[0]!;
    expect(first.textContent).toContain("R$10.00");
    expect(first.textContent).not.toContain("R$1,201.00");
  });

  it("draws a negative bar in danger below the baseline and says Short", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue(OVER);
    const view = open();
    await loaded();
    await userEvent.click(screen.getByRole("radio", { name: "At current pace" }));
    expect(view.container.querySelectorAll("span.bg-danger")).toHaveLength(1);
    expect(barNames()[2]).toBe("March 2030: leftover -R$900.00");
    await userEvent.click(bars()[2]!);
    expect(within(screen.getByRole("region", { name: "March 2030" })).getByText("Short")).toBeTruthy();
    expect(view.container.querySelectorAll("span.bg-danger.outline-text")).toHaveLength(1);
  });

  it("says nothing of shortage when no month is over", async () => {
    open();
    await loaded();
    expect(screen.queryByText("Short")).toBeNull();
  });
});

describe("the chosen month", () => {
  it.each([true, false])("is a sum that adds up to its Leftover, with the cut as a line (desktop %s)", async (desktop) => {
    width(desktop);
    open();
    const detail = await screen.findByRole("region", { name: "January 2030" });
    const dl = detail.querySelector("dl")!;
    const lines = [...dl.children].map(line);
    expect(lines).toEqual([
      "Monthly income R$5,000.00", "− Card bills R$1,000.00", "− Other bills R$2,000.00", "− Planned spending R$300.00", "− Put aside R$500.00",
      "Leftover by plan R$1,201.00", "− Eating out above plan R$1,200.00", "Leftover at current pace R$10.00",
    ]);
    expect(1201_00 - 1200_00 + 9_00).toBe(10_00);
  });

  it("starts with this month and follows a click on a row", async () => {
    width(true);
    open();
    const table = await screen.findByRole("table");
    expect(screen.getByRole("region", { name: "January 2030" })).toBeTruthy();
    await userEvent.click(within(table).getByRole("button", { name: /March 2030/ }));
    expect(screen.getByRole("region", { name: "March 2030" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "January 2030" })).toBeNull();
    const feb = within(table).getByRole("button", { name: /February 2030/ });
    feb.focus();
    await userEvent.keyboard("{Enter}");
    expect(feb.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "February 2030" })).toBeTruthy();
  });

  it("follows a tap on a phone row and on a bar", async () => {
    open();
    const list = await screen.findByRole("region", { name: "Coming months" });
    await userEvent.click(within(list).getByRole("button", { name: /March 2030/ }));
    expect(screen.getByRole("region", { name: "March 2030" })).toBeTruthy();
    await userEvent.click(bars()[4]!);
    expect(screen.getByRole("region", { name: "May 2030" })).toBeTruthy();
    expect(bars()[4]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("lists no cut when the pace is at or under the plan, nor a spent line when the month has none", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue({ ...DATA, months: [month(1, { planned: [{ category: "pets", cents: 50000, paceCents: 20000, limited: true }] }), ...MONTHS.slice(1)] });
    open();
    const dl = (await screen.findByRole("region", { name: "January 2030" })).querySelector("dl")!;
    expect(dl.textContent).not.toContain("above plan");
    expect(dl.textContent).not.toContain("Spent off the card");
  });

  it("adds a line for what was spent off the card when the current month has it", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue({ ...DATA, months: [month(1, { spentOffCardCents: 10000 }), ...MONTHS.slice(1)] });
    open();
    const dl = (await screen.findByRole("region", { name: "January 2030" })).querySelector("dl")!;
    expect([...dl.children].map(line)).toContain("− Spent off the card R$100.00");
  });
});

describe("income", () => {
  it.each([true, false])("without income there is a link to Settings and no Leftover chart or sum (desktop %s)", async (desktop) => {
    width(desktop);
    vi.mocked(api.getCommitments).mockResolvedValue(NO_INCOME);
    open();
    const link = await screen.findByRole("link", { name: "Set monthly income" });
    expect(link.getAttribute("href")).toBe("/settings");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("region", { name: "January 2030" })).toBeNull();
    expect(screen.getByText("What is left of your income over the next 12 months")).toBeTruthy();
  });

  it("without income the table keeps six columns and shows a dash for both Leftovers", async () => {
    width(true);
    vi.mocked(api.getCommitments).mockResolvedValue(NO_INCOME);
    open();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    const jan = within(table).getAllByRole("row")[1]!;
    const cells = within(jan).getAllByRole("cell");
    expect(cells.slice(-2).map((c) => c.textContent)).toEqual(["—No value", "—No value"]);
  });

  it("without income the phone list shows a dash for the Leftover", async () => {
    vi.mocked(api.getCommitments).mockResolvedValue(NO_INCOME);
    open();
    const list = await screen.findByRole("region", { name: "Coming months" });
    expect(within(list).getAllByRole("button")).toHaveLength(12);
    expect(within(list).getAllByText("—")).toHaveLength(12);
  });

  it("with income there is no such link", async () => {
    open();
    await loaded();
    expect(screen.queryByRole("link", { name: "Set monthly income" })).toBeNull();
  });
});

describe("hide values", () => {
  const hiddenPage = () => {
    localStorage.setItem("revenue.hideValues", "1");
    return renderApp(<HideValuesProvider><ProjectionPage /></HideValuesProvider>, { path: "/projection", locale: "en" });
  };

  it.each([true, false])("masks the table or list, the bars, the sum and the subtitle (desktop %s)", async (desktop) => {
    width(desktop);
    vi.mocked(api.getCommitments).mockResolvedValue(OVER);
    const { container } = hiddenPage();
    await loaded();
    expect(container.textContent).not.toMatch(/\d[,.]\d\d/);
    expect(barNames()[0]).toBe("January 2030: leftover hidden value");
    expect(screen.getAllByText("hidden value").length).toBeGreaterThan(8);
  });

  it("masks every amount of the detail's sum and keeps its two total labels", async () => {
    const { container } = hiddenPage();
    const dl = (await screen.findByRole("region", { name: "January 2030" })).querySelector("dl")!;
    expect(dl.textContent).not.toMatch(/\d/);
    expect(dl.textContent).toContain("Leftover by plan");
    expect(dl.textContent).toContain("Leftover at current pace");
    expect(container.querySelectorAll("dl dd")).toHaveLength(8);
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
    await loaded();
    expect(screen.queryByRole("region", { name: "Installments in progress" })).toBeNull();
  });
});

describe("states", () => {
  it("offers a retry when the read fails", async () => {
    vi.mocked(api.getCommitments).mockRejectedValueOnce(new Error("x"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await loaded();
  });

  it("speaks pt-BR", async () => {
    open({ locale: "pt-BR" });
    await waitFor(() => expect(screen.getAllByText("Janeiro de 2030").length).toBeGreaterThan(0));
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
      await screen.findAllByRole(desktop ? "table" : "region", desktop ? {} : { name: /Coming months|Próximos meses/ });
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
