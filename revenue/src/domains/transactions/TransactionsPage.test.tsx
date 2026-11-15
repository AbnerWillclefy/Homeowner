import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import { addMonths, monthLabel, saoPauloDay } from "../../shared/month/month";
import { getMonth, patchTransaction, type PatchResult, type Transaction } from "./api";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getMonth: vi.fn(), patchTransaction: vi.fn() }));

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t1", postedOn: "2026-01-05", countsOn: "2026-01-05", description: "Mercado Boa Compra", sourceName: "Nubank", amountCents: -15000,
  type: "expense", spendingCategory: "groceries", installment: null, ...over,
});
const MERCADO = tx({});
const SALARIO = tx({ id: "t2", description: "Salário", amountCents: 500000, type: "income", spendingCategory: null });
const LONG = tx({ id: "t3", description: "COMPRA NO CARTAO LOJA EXTREMAMENTE LONGA DESCRICAO ".repeat(3).trim(), type: "expense", spendingCategory: null });
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const PATH = "/transactions?month=2026-01";

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const month = (transactions: Transaction[]) => vi.mocked(getMonth).mockResolvedValue({ month: "2026-01", transactions });
const thisMonth = () => saoPauloDay(new Date()).slice(0, 7);
const patch = vi.mocked(patchTransaction);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getMonth).mockReset();
  patch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<HideValuesProvider><TransactionsPage /></HideValuesProvider>, { path: PATH, locale: "en", ...options });

describe("layout", () => {
  it("is a table on a desktop width, with the whole long description", async () => {
    width(true);
    month([MERCADO, LONG]);
    open();
    const table = await screen.findByRole("table", { name: "Transactions of January 2026" });
    expect(within(table).getByRole("button", { name: LONG.description })).toBeTruthy();
    expect(within(table).getByRole("button", { name: "Mercado Boa Compra" })).toBeTruthy();
  });

  it("groups the table's rows under a heading per day, newest first", async () => {
    width(true);
    month([MERCADO, tx({ id: "t9", description: "Padaria", postedOn: "2026-01-09" })]);
    open();
    const table = await screen.findByRole("table");
    const days = within(table).getAllByRole("rowheader").map((h) => h.textContent);
    expect(days).toEqual(["Jan 9", "Jan 5"]);
  });

  it("is a list per day on a phone width, with chips instead of the segment", async () => {
    width(false);
    month([MERCADO, SALARIO]);
    open();
    const list = await screen.findByRole("list", { name: "Transactions of January 2026, Jan 5" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Income" })).toBeNull();
    expect(screen.getByRole("button", { name: "Income" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Totals of the month" })).toBeNull();
  });

  it("says the month, its Transactions and its Sources in the header", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    expect(await screen.findByText("January 2026 · 2 transactions from 1 source")).toBeTruthy();
  });
});

describe("month", () => {
  it("reads the month chosen in the header select", async () => {
    width(true);
    month([MERCADO]);
    open({ path: "/transactions" });
    await screen.findByText("Mercado Boa Compra");
    const previous = addMonths(thisMonth(), -1);
    await userEvent.click(screen.getByRole("combobox", { name: "Month" }));
    await userEvent.click(await screen.findByRole("option", { name: monthLabel(previous, "en") }));
    await waitFor(() => expect(vi.mocked(getMonth)).toHaveBeenCalledWith(previous));
  });
});

describe("totals", () => {
  const REFUND = tx({ id: "t4", description: "Estorno", amountCents: 2000 });
  const NOCAT = tx({ id: "t5", description: "PIX misterioso", amountCents: -5000, spendingCategory: null });

  it("shows the month's Spent, Income and uncategorised count, whatever the filter", async () => {
    width(true);
    month([MERCADO, SALARIO, REFUND, NOCAT]);
    open();
    const totals = await screen.findByRole("region", { name: "Totals of the month" });
    expect(within(totals).getByText(/R\$\s?180\.00/)).toBeTruthy();
    expect(within(totals).getByText(/\+R\$\s?5,000\.00/)).toBeTruthy();
    expect(within(totals).getByText("1")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Income" }));
    expect(within(totals).getByText(/R\$\s?180\.00/)).toBeTruthy();
  });

  it("filters to uncategorised Expenses from Review", async () => {
    width(true);
    month([MERCADO, SALARIO, NOCAT]);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(screen.queryByRole("button", { name: "Mercado Boa Compra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salário" })).toBeNull();
    expect(screen.getByRole("button", { name: "PIX misterioso" })).toBeTruthy();
    expect(screen.getByText("1 of 3 transactions")).toBeTruthy();
  });

  it("filters to them from the phone's chip", async () => {
    width(false);
    month([MERCADO, NOCAT]);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "No category · 1" }));
    expect(screen.queryByText("Mercado Boa Compra")).toBeNull();
    expect(screen.getByText("PIX misterioso")).toBeTruthy();
  });

  it("drops a type filter when the phone's chip turns on", async () => {
    width(false);
    month([MERCADO, SALARIO, NOCAT]);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Income" }));
    await userEvent.click(screen.getByRole("button", { name: "No category · 1" }));
    expect(screen.getByText("PIX misterioso")).toBeTruthy();
  });
});

describe("hide values", () => {
  it("masks the amounts in the table, the totals and the sheet", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    await screen.findByText("Salário");
    expect(screen.getAllByText(/5,000\.00/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Hide values" }));
    expect(screen.queryByText(/5,000\.00/)).toBeNull();
    expect(screen.queryByText(/150\.00/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mercado Boa Compra" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("hidden value").length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/150\.00/)).toBeNull();
  });
});

describe("states", () => {
  it("says an empty month calmly", async () => {
    width(false);
    month([]);
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Nada por aqui neste mês")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error with a way to retry", async () => {
    width(false);
    vi.mocked(getMonth).mockRejectedValueOnce(new Error("down"));
    open();
    month([MERCADO]);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Mercado Boa Compra")).toBeTruthy();
  });

  it("filters by the segment and Clear all resets it", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    await screen.findByText("Salário");
    await userEvent.click(screen.getByRole("radio", { name: "Income" }));
    expect(screen.queryByText("Mercado Boa Compra")).toBeNull();
    expect(screen.getByText("1 of 2 transactions")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("Mercado Boa Compra")).toBeTruthy();
    expect(screen.getByText("2 of 2 transactions")).toBeTruthy();
  });

  it("keeps the Transfer and Saving filters in the filters sheet, and the no-results state offers Clear all", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Filters" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Transfer" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("No transactions match this filter")).toBeTruthy();
    const clear = screen.getAllByRole("button", { name: "Clear all" });
    await userEvent.click(clear[clear.length - 1]!);
    expect(await screen.findByText("Salário")).toBeTruthy();
  });

  it("searches the description, ignoring accents, and the amount", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    await screen.findByText("Salário");
    const search = screen.getByRole("searchbox", { name: "Search transactions" });
    await userEvent.type(search, "salario");
    expect(screen.queryByText("Mercado Boa Compra")).toBeNull();
    expect(screen.getByText("Salário")).toBeTruthy();
    await userEvent.clear(search);
    await userEvent.type(search, "150,00");
    expect(screen.queryByText("Salário")).toBeNull();
    expect(screen.getByText("Mercado Boa Compra")).toBeTruthy();
  });

  it("offers Clear all when a search finds nothing", async () => {
    width(false);
    month([MERCADO]);
    open();
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search transactions" }), "zzz");
    expect(await screen.findByText("No transactions match this filter")).toBeTruthy();
    const clear = screen.getAllByRole("button", { name: "Clear all" });
    await userEvent.click(clear[clear.length - 1]!);
    expect(screen.getByText("Mercado Boa Compra")).toBeTruthy();
  });
});

describe("editing", () => {
  const editRow = async (name: string) => {
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
    return screen.findByRole("dialog");
  };

  it("shows the detail in the side panel, without the use-for-next-purchases switch", async () => {
    width(true);
    month([MERCADO]);
    open();
    const dialog = await editRow("Mercado");
    expect(within(dialog).getByText("Nubank · Jan 5")).toBeTruthy();
    expect(within(dialog).getByText(/150\.00/)).toBeTruthy();
    expect(within(dialog).getByText("Changes here apply at once.")).toBeTruthy();
    expect(within(dialog).queryByRole("switch")).toBeNull();
  });

  it("offers the Spending Category only for an expense", async () => {
    width(true);
    month([MERCADO, SALARIO]);
    open();
    let dialog = await editRow("Mercado");
    expect(within(dialog).getByRole("combobox", { name: "Spending Category" })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Income" }));
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    dialog = await editRow("Salário");
    expect(within(dialog).queryByRole("combobox")).toBeNull();
  });

  it("updates the row before the API answers, then keeps the server's row", async () => {
    width(true);
    month([MERCADO]);
    let answer!: (r: PatchResult) => void;
    patch.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    open();
    const dialog = await editRow("Mercado");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Saving" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(patch).toHaveBeenCalledWith("t1", { type: "saving" });
    const row = (await screen.findByRole("button", { name: "Mercado Boa Compra" })).closest("tr")!;
    await waitFor(() => expect(within(row).getByText("Saving")).toBeTruthy());
    answer({ kind: "ok", transaction: { ...MERCADO, type: "saving", spendingCategory: null } });
    await waitFor(() => expect(within(row).getByText("Saving")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("changes the category from the select", async () => {
    width(true);
    month([MERCADO]);
    const saved = { ...MERCADO, spendingCategory: "pets" as const };
    patch.mockImplementation(async () => (month([saved]), { kind: "ok", transaction: saved }));
    open();
    const dialog = await editRow("Mercado");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Spending Category" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pets" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(patch).toHaveBeenCalledWith("t1", { spendingCategory: "pets" });
    expect(await screen.findByText("Pets")).toBeTruthy();
  });

  it("rolls the row back and says so when the API refuses", async () => {
    width(true);
    month([MERCADO]);
    patch.mockResolvedValue({ kind: "error" });
    open();
    const dialog = await editRow("Mercado");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Transfer" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    const row = screen.getByRole("button", { name: "Mercado Boa Compra" }).closest("tr")!;
    expect(within(row).getByText("Expense")).toBeTruthy();
    expect(within(row).queryByText("Transfer")).toBeNull();
  });

  it("says the row is gone and reads the month again when the API cannot find it", async () => {
    width(true);
    month([MERCADO]);
    patch.mockResolvedValue({ kind: "not-found" });
    open();
    const dialog = await editRow("Mercado");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Transfer" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no longer here");
    await waitFor(() => expect(vi.mocked(getMonth)).toHaveBeenCalledTimes(2));
  });

  it("reads the month again after a save", async () => {
    width(true);
    month([MERCADO]);
    patch.mockResolvedValue({ kind: "ok", transaction: { ...MERCADO, type: "income", spendingCategory: null } });
    const { client } = open();
    const dialog = await editRow("Mercado");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Income" }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["finance", "transactions"], ["finance", "history"], ["finance", "commitments"]]);
  });
});

describe("accessibility", () => {
  const COMBOS = [["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const;
  describe.each(COMBOS)("%s %s", (theme, locale) => {
    it.each([true, false])("screen, desktop %s", async (desktop) => {
      width(desktop);
      month([MERCADO, SALARIO, LONG]);
      open({ theme, locale });
      await screen.findByText("Salário");
      const { violations } = await axe.run(document.body, AXE);
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
    it("edit sheet", async () => {
      width(false);
      month([MERCADO]);
      open({ theme, locale });
      await userEvent.click(await screen.findByText("Mercado Boa Compra"));
      await screen.findByRole("dialog");
      const { violations } = await axe.run(document.body, AXE);
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  });
});
