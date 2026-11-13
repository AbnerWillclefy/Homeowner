import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
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
const patch = vi.mocked(patchTransaction);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getMonth).mockReset();
  patch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<TransactionsPage />, { path: PATH, locale: "en", ...options });

describe("layout", () => {
  it("is a table on a desktop width, with the whole long description", async () => {
    width(true);
    month([MERCADO, LONG]);
    open();
    const table = await screen.findByRole("table", { name: "Transactions of January 2026" });
    expect(within(table).getByRole("button", { name: LONG.description })).toBeTruthy();
    expect(within(table).getByRole("button", { name: "Mercado Boa Compra" })).toBeTruthy();
  });

  it("is a list on a phone width", async () => {
    width(false);
    month([MERCADO, SALARIO]);
    open();
    const list = await screen.findByRole("list", { name: "Transactions of January 2026" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("table")).toBeNull();
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

  it("filters by type and can clear the filter", async () => {
    width(false);
    month([MERCADO, SALARIO]);
    open();
    await screen.findByText("Salário");
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Income" }));
    expect(screen.queryByText("Mercado Boa Compra")).toBeNull();
    expect(screen.getByText("Salário")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Transfer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Mercado Boa Compra")).toBeTruthy();
  });
});

describe("editing", () => {
  const editRow = async (name: string) => {
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
    return screen.findByRole("dialog");
  };

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
