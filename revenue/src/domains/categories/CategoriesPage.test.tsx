import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { History, Spending } from "./api";
import { CategoriesPage } from "./CategoriesPage";
import { CategoryPage } from "./CategoryPage";
import { Route, Routes } from "react-router";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getSpending: vi.fn(), getHistory: vi.fn(), putBudget: vi.fn() }));

const tx = (over: Partial<Spending["transactions"][number]>): Spending["transactions"][number] =>
  ({ id: "t1", postedOn: "2030-01-05", description: "Mercado Central", amountCents: -180000, type: "expense", spendingCategory: "groceries", categorySetBy: "auto", ...over });
const SPENDING: Spending = {
  categories: [{ category: "groceries", spentCents: 180000 }, { category: "eating_out", spentCents: 22000 }, { category: "pets", spentCents: 10000 }],
  limits: { groceries: 200000, eating_out: 20000, pets: 10000 },
  transactions: [tx({}), tx({ id: "t2", description: "Pix 8841", amountCents: -4500, spendingCategory: "other", categorySetBy: "fallback" })],
};
const HISTORY: History = { months: [{ month: "2029-12", spentCents: 150000, categories: [{ category: "groceries", spentCents: 150000 }] }, { month: "2030-01", spentCents: 180000, categories: [{ category: "groceries", spentCents: 180000 }] }] };
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

// Intl puts a no-break space after the currency symbol.
const text = (s: string) => s.replace(/\u00a0/g, " ");
const nb = (s: string) => (node: string) => text(node) === s;
const list = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<CategoriesPage />, { path: "/categories", locale: "en", ...options });
const detail = (id: string, options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(<Routes><Route path="/categories/:category" element={<CategoryPage />} /></Routes>, { path: `/categories/${id}`, locale: "en", ...options });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  for (const fn of [api.getSpending, api.getHistory, api.putBudget]) vi.mocked(fn).mockReset();
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
    expect(await screen.findByRole("heading", { name: "1 without a category" })).toBeTruthy();
    expect(screen.getByText("Pix 8841")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See in Transactions" }).getAttribute("href")).toBe("/transactions?month=2030-01");
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

describe("accessibility", () => {
  it.each([
    ["pt-BR", "dark"], ["pt-BR", "light"], ["en", "dark"], ["en", "light"],
  ] as const)("has no violations in %s, %s theme", async (locale, theme) => {
    const view = list({ locale, theme });
    await screen.findAllByRole("progressbar");
    expect((await axe.run(view.container, AXE)).violations).toEqual([]);
    view.unmount();
    const drill = detail("groceries", { locale, theme });
    await screen.findByRole("textbox");
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
    expect(await screen.findByRole("list", { name: "Recent months" })).toBeTruthy();
    expect(api.getHistory).toHaveBeenCalledWith("2030-01", 6);
    expect(screen.getByText("Mercado Central")).toBeTruthy();
    expect(screen.queryByText("Pix 8841")).toBeNull();
  });

  it("hides only the history when its read fails", async () => {
    vi.mocked(api.getHistory).mockRejectedValue(new Error("down"));
    detail("groceries");
    expect(await screen.findByText("We could not load the history")).toBeTruthy();
    expect(screen.getByText(nb("R$200.00 under the limit"))).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByText("Mercado Central")).toBeTruthy();
  });
});
