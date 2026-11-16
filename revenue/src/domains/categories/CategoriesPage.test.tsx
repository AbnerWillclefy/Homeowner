import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as billsApi from "../bills/api";
import * as api from "./api";
import type { History, Spending } from "./api";
import { CategoriesPage } from "./CategoriesPage";
import { CategoryPage } from "./CategoryPage";
import { Route, Routes } from "react-router";

vi.mock("../bills/api", async (original) => ({ ...(await original<typeof import("../bills/api")>()), getBills: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getSpending: vi.fn(), getHistory: vi.fn(), putBudget: vi.fn() }));

const tx = (over: Partial<Spending["transactions"][number]>): Spending["transactions"][number] =>
  ({ id: "t1", postedOn: "2030-01-05", description: "Mercado Central", sourceName: "Nubank", amountCents: -180000, type: "expense", spendingCategory: "groceries", categorySetBy: "auto", ...over });
const SPENDING: Spending = {
  categories: [{ category: "groceries", spentCents: 180000 }, { category: "eating_out", spentCents: 22000 }, { category: "pets", spentCents: 10000 }],
  limits: { groceries: 200000, eating_out: 20000, pets: 10000 },
  transactions: [tx({}), tx({ id: "t2", description: "Pix 8841", amountCents: -4500, spendingCategory: "other", categorySetBy: "fallback" })],
};
// December: groceries 1,500, eating out 200, no pets. So January is +20% in groceries, +10% eating out and nothing to compare for pets; +25% in all.
const HISTORY: History = { months: [
  { month: "2029-12", spentCents: 170000, categories: [{ category: "groceries", spentCents: 150000 }, { category: "eating_out", spentCents: 20000 }] },
  { month: "2030-01", spentCents: 212000, categories: [{ category: "groceries", spentCents: 180000 }] },
] };
const BILL = { id: "b1", name: "Aluguel", expectedCents: 350000, dueDay: 5, dueDate: "2030-01-05", paid: false, paidBy: null, paidCents: null };
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

// Intl puts a no-break space after the currency symbol.
const text = (s: string) => s.replace(/\u00a0/g, " ");
const nb = (s: string) => (node: string) => text(node) === s;
const list = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<HideValuesProvider><CategoriesPage /></HideValuesProvider>, { path: "/categories", locale: "en", ...options });
const detail = (id: string, options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(<Routes><Route path="/categories/:category" element={<CategoryPage />} /></Routes>, { path: `/categories/${id}`, locale: "en", ...options });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  for (const fn of [api.getSpending, api.getHistory, api.putBudget, billsApi.getBills]) vi.mocked(fn).mockReset();
  vi.mocked(billsApi.getBills).mockResolvedValue([BILL]);
  vi.mocked(api.getSpending).mockResolvedValue(SPENDING);
  vi.mocked(api.getHistory).mockResolvedValue(HISTORY);
  localStorage.clear();
});

afterEach(() => vi.useRealTimers());

describe("the bar against the limit", () => {
  it.each([
    ["en", "Groceries", "R$1,800.00 of R$2,000.00", "R$200.00 under the limit"],
    ["en", "Pets", "R$100.00 of R$100.00", "At the limit of R$100.00"],
    ["en", "Eating out", "R$220.00 of R$200.00", "R$20.00 over the limit"],
    ["pt-BR", "Restaurantes", "R$ 220,00 de R$ 200,00", "R$ 20,00 acima do limite"],
  ] as const)("says %s %s in words", async (locale, name, of, words) => {
    list({ locale });
    const row = (await screen.findByRole("link", { name })).closest("li")!;
    expect(within(row).getByText(nb(of))).toBeTruthy();
    expect(within(row).getByText(nb(words))).toBeTruthy();
    expect(text(within(row).getByRole("progressbar").getAttribute("aria-valuetext") ?? "")).toContain(words);
  });

  it("never turns an over-limit bar to an alarm colour or tone", async () => {
    const { container } = list();
    await screen.findByRole("link", { name: "Eating out" });
    expect(container.querySelector(".bg-danger, .text-danger, .bg-warning")).toBeNull();
  });

  it("says a category without a limit has none", async () => {
    vi.mocked(api.getSpending).mockResolvedValue({ ...SPENDING, limits: {} });
    list();
    expect((await screen.findAllByText("No Spending limit")).length).toBe(3);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("the list", () => {
  it("splits the month in a chart with a table as its alternative, and links each category", async () => {
    list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.getByRole("img", { name: /Groceries takes 85% of spending/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Groceries" }).getAttribute("href")).toBe("/categories/groceries");
  });

  it("groups the expenses nothing could categorise, with the way to pick one", async () => {
    list();
    expect(await screen.findByRole("heading", { name: "Without a category" })).toBeTruthy();
    expect(screen.getByText("1 without a category")).toBeTruthy();
    expect(screen.getByText("Pix 8841")).toBeTruthy();
    expect(screen.getByText("Nubank · Jan 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Categorise" }).getAttribute("href")).toBe("/transactions?month=2030-01");
  });

  it("shows an error with a way to retry", async () => {
    vi.mocked(api.getSpending).mockRejectedValueOnce(new Error("down"));
    list();
    (await screen.findByRole("button", { name: "Try again" })).click();
    expect(await screen.findByRole("link", { name: "Groceries" })).toBeTruthy();
  });

  it("says an empty month calmly", async () => {
    vi.mocked(api.getSpending).mockResolvedValue({ categories: [], limits: {}, transactions: [] });
    list({ locale: "pt-BR" });
    expect(await screen.findByText("Nenhum gasto neste mês")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the layout", () => {
  it("puts the header tools, the total card and the 8 and 4 column grid in order", async () => {
    const { container } = list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.getByRole("heading", { level: 1, name: "Spending Categories" })).toBeTruthy();
    expect(screen.getByText("Everyday spending, without fixed bills")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit limits" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Month" })).toBeTruthy();
    const grid = container.querySelector(".desktop\\:grid-cols-12")!;
    expect(grid.children[0]!.className).toContain("desktop:col-span-8");
    expect(grid.children[1]!.className).toContain("desktop:col-span-4");
    expect(within(grid.children[0] as HTMLElement).getByRole("heading", { name: "January 2030 by category" })).toBeTruthy();
    expect(within(grid.children[1] as HTMLElement).getByRole("heading", { name: "Without a category" })).toBeTruthy();
  });

  it("shows the month total and its change against the previous month, above the grid", async () => {
    list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.getByText("Spent in January 2030")).toBeTruthy();
    expect(screen.getAllByText(nb("R$2,120.00")).length).toBe(2);
    expect(screen.getByText("+25% vs previous month")).toBeTruthy();
  });
});

describe("the change against the previous month", () => {
  it("is on each row, and absent when the previous month spent nothing there", async () => {
    list();
    const row = (name: string) => screen.getByRole("link", { name }).closest("li")!;
    await screen.findByRole("link", { name: "Groceries" });
    expect(within(row("Groceries")).getByText("+20% vs previous month")).toBeTruthy();
    expect(within(row("Eating out")).getByText("+10% vs previous month")).toBeTruthy();
    expect(within(row("Pets")).queryByText(/vs previous month/)).toBeNull();
  });

  it("reads two months of history ending at the month", async () => {
    list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(api.getHistory).toHaveBeenCalledWith("2030-01", 2);
  });

  it("leaves the badges out, not the screen, when the history fails", async () => {
    vi.mocked(api.getHistory).mockRejectedValue(new Error("down"));
    list();
    expect(await screen.findByRole("link", { name: "Groceries" })).toBeTruthy();
    expect(screen.queryByText(/vs previous month/)).toBeNull();
  });
});

describe("the day of the month", () => {
  it("is said on the current month", async () => {
    list();
    expect(await screen.findByText("Day 10 of 31 · 32% of the month")).toBeTruthy();
  });

  it("is not said on a past month", async () => {
    list({ path: "/categories?month=2029-12" });
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.queryByText(/of the month/)).toBeNull();
  });
});

describe("the month select", () => {
  it("reads the chosen month, and the drill-down link keeps it", async () => {
    list();
    await screen.findByRole("link", { name: "Groceries" });
    await userEvent.click(screen.getByRole("combobox", { name: "Month" }));
    await userEvent.click(await screen.findByRole("option", { name: "December 2029" }));
    await waitFor(() => expect(api.getSpending).toHaveBeenCalledWith("2029-12"));
    expect((await screen.findByRole("link", { name: "Groceries" })).getAttribute("href")).toBe("/categories/groceries?month=2029-12");
  });
});

describe("the fixed bills card", () => {
  it("lists the month's Bills and links to them", async () => {
    list();
    const card = (await screen.findByRole("heading", { name: "Fixed bills, outside this chart" })).closest("section, div")!.parentElement!;
    expect(billsApi.getBills).toHaveBeenCalledWith("2030-01");
    expect(within(card).getByText("Aluguel")).toBeTruthy();
    expect(within(card).getByText(nb("R$3,500.00"))).toBeTruthy();
    expect(within(card).getByRole("link", { name: "See bills to pay" }).getAttribute("href")).toBe("/bills");
  });

  it("is left out when there are no Bills", async () => {
    vi.mocked(billsApi.getBills).mockResolvedValue([]);
    list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.queryByRole("heading", { name: "Fixed bills, outside this chart" })).toBeNull();
  });
});

describe("editing the limits", () => {
  it("saves only the limits that changed, and closes", async () => {
    vi.mocked(api.putBudget).mockResolvedValue({ kind: "ok" });
    list();
    await userEvent.click(await screen.findByRole("button", { name: "Edit limits" }));
    const dialog = await screen.findByRole("dialog");
    const pets = within(dialog).getByRole("textbox", { name: "Pets limit" });
    await userEvent.clear(pets);
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Health limit" }), "300");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(api.putBudget).mock.calls.sort()).toEqual([["health", 30000], ["pets", null]]);
  });

  it("stays open and says so when a write fails, and retries only that one", async () => {
    vi.mocked(api.putBudget).mockResolvedValueOnce({ kind: "error" }).mockResolvedValue({ kind: "ok" });
    list();
    await userEvent.click(await screen.findByRole("button", { name: "Edit limits" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Health limit" }), "300");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    expect(await within(dialog).findByText(/could not save every limit/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(api.putBudget).mock.calls).toEqual([["health", 30000], ["health", 30000]]);
  });

  it("writes nothing for a limit of zero", async () => {
    list();
    await userEvent.click(await screen.findByRole("button", { name: "Edit limits" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Health limit" }), "0");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    expect(await within(dialog).findByText("Enter an amount above zero.")).toBeTruthy();
    expect(api.putBudget).not.toHaveBeenCalled();
  });
});

describe("hide values", () => {
  it("masks the row amounts, the total, the bar's words, the fixed bills and the donut's centre", async () => {
    list();
    await screen.findByRole("link", { name: "Groceries" });
    expect(screen.getAllByText(/2,120\.00/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Hide values" }));
    for (const money of [/2,120\.00/, /1,800\.00/, /3,500\.00/, /45\.00/, /200\.00 under/]) expect(screen.queryByText(money)).toBeNull();
    expect(screen.getAllByText("hidden value").length).toBeGreaterThan(0);
  });
});

describe("accessibility", () => {
  it.each([
    ["pt-BR", "dark"], ["pt-BR", "light"], ["en", "dark"], ["en", "light"],
  ] as const)("has no violations in %s, %s theme", async (locale, theme) => {
    const view = list({ locale, theme });
    await screen.findAllByRole("progressbar");
    expect((await axe.run(view.container, AXE)).violations).toEqual([]);
    view.unmount();
    const drill = detail("groceries", { locale, theme });
    await screen.findByRole("img", { name: /Recent months|Últimos meses/ });
    await screen.findAllByRole("progressbar");
    expect((await axe.run(drill.container, AXE)).violations).toEqual([]);
  });
});

describe("the drill-down", () => {
  it("says not found for an id that is no Spending Category, and reads nothing", async () => {
    detail("not-a-category");
    expect(screen.getAllByText("Page not found").length).toBeGreaterThan(0);
    expect(api.getSpending).not.toHaveBeenCalled();
  });

  it("shows the category's spent, bar, history and expenses", async () => {
    detail("groceries");
    expect(await screen.findByRole("heading", { name: "Groceries" })).toBeTruthy();
    expect(await screen.findByText(nb("R$200.00 under the limit"))).toBeTruthy();
    expect(await screen.findByRole("img", { name: "Recent months" })).toBeTruthy();
    expect(api.getHistory).toHaveBeenCalledWith("2030-01", 6);
    expect(screen.getByText("Mercado Central")).toBeTruthy();
    expect(screen.queryByText("Pix 8841")).toBeNull();
  });

  it("hides only the history when its read fails", async () => {
    vi.mocked(api.getHistory).mockRejectedValue(new Error("down"));
    detail("groceries");
    expect(await screen.findByText("We could not load the history")).toBeTruthy();
    expect(screen.getByText(nb("R$200.00 under the limit"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit limit" })).toBeTruthy();
    expect(screen.getByText("Mercado Central")).toBeTruthy();
  });
});
