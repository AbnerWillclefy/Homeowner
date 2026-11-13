import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { CardBill, CardSource, CardTransaction } from "./api";
import { CardBillsPage } from "./CardBillsPage";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getCardBills: vi.fn(), getCardSources: vi.fn(), getMonthTransactions: vi.fn(), putBillDays: vi.fn(),
}));

const CLOSED: CardBill = { sourceId: "s1", name: "Nubank", amountCents: 284300, billDaysKnown: true, fromBank: true, dueOn: "2030-01-15", closesOn: "2030-01-08", closed: false, heldFrom: null, heldTo: null };
const OPEN: CardBill = { sourceId: "s2", name: "Itaú Visa", amountCents: 50000, billDaysKnown: false, fromBank: false, dueOn: null, closesOn: null, closed: false, heldFrom: null, heldTo: null };
const SOURCES: CardSource[] = [{ id: "s1", name: "Nubank", closeDay: 8, dueDay: 15 }, { id: "s2", name: "Itaú Visa", closeDay: null, dueDay: null }];
const tx = (over: Partial<CardTransaction>): CardTransaction => ({ id: "t1", sourceId: "s1", description: "Mercado Central", postedOn: "2029-12-20", countsOn: "2030-01-15", amountCents: -28430, installment: null, ...over });
const ROWS = [
  tx({}),
  tx({ id: "t2", description: "Geladeira Frost Free", postedOn: "2029-12-22", amountCents: -3249, installment: { number: 3, total: 10 } }),
  tx({ id: "t3", description: "Outro cartão", sourceId: "s2" }),
  tx({ id: "t4", description: "Fatura de fevereiro", countsOn: "2030-02-15" }),
];
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const serve = (cards: CardBill[] = [CLOSED, OPEN]) => {
  vi.mocked(api.getCardBills).mockResolvedValue(cards);
  vi.mocked(api.getCardSources).mockResolvedValue(SOURCES);
  vi.mocked(api.getMonthTransactions).mockImplementation(async (month: string) => ROWS.filter((r) => r.countsOn.startsWith(month)));
};
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<CardBillsPage />, { path: "/card-bills", locale: "en", ...options });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  localStorage.clear();
  for (const fn of [api.getCardBills, api.getCardSources, api.getMonthTransactions, api.putBillDays]) vi.mocked(fn).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("labels per bill kind", () => {
  it("calls a closed bill the bank's total and an open one the app's sum", async () => {
    width(false);
    serve();
    open();
    const closed = (await screen.findByRole("heading", { name: "Nubank" })).closest("div[class*=border]") as HTMLElement;
    expect(within(closed).getByText("Closed")).toBeTruthy();
    expect(within(closed).getByText("Total reported by the bank")).toBeTruthy();
    expect(closed.textContent).toContain("R$");
    expect(closed.textContent).toContain("2,843.00");
    expect(closed.textContent).toContain("Closes");
    const opened = screen.getByRole("heading", { name: "Itaú Visa" }).closest("div[class*=border]") as HTMLElement;
    expect(within(opened).getByText("Open")).toBeTruthy();
    expect(within(opened).getByText(/^App's sum/)).toBeTruthy();
    expect(within(opened).getByText("No closing and due days yet")).toBeTruthy();
  });

  it("calls a bill closed by the typed days closed, still the app's sum", async () => {
    width(false);
    serve([{ ...OPEN, billDaysKnown: true, closed: true, heldFrom: "2029-12-08", heldTo: "2030-01-08", closesOn: "2030-01-08", dueOn: "2030-01-15" }]);
    open();
    const card = (await screen.findByRole("heading", { name: "Itaú Visa" })).closest("div[class*=border]") as HTMLElement;
    expect(within(card).getByText("Closed")).toBeTruthy();
    expect(within(card).getByText(/^App's sum/)).toBeTruthy();
    expect(card.textContent).toContain("Closes");
  });

  it("does not say days are missing on an open bill whose days are set", async () => {
    width(false);
    serve([{ ...OPEN, billDaysKnown: true }]);
    open();
    await screen.findByRole("heading", { name: "Itaú Visa" });
    expect(screen.queryByText("No closing and due days yet")).toBeNull();
  });

  it("says it in Portuguese first", async () => {
    width(false);
    serve();
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Total informado pelo banco")).toBeTruthy();
    expect(screen.getByText(/^Soma do app/)).toBeTruthy();
  });
});

describe("rows", () => {
  it("lists the card's rows counted in the month, as a list on a phone", async () => {
    width(false);
    serve();
    open();
    const list = await screen.findByRole("list", { name: "Transactions of Nubank in January 2030" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Geladeira Frost Free"),
      expect.stringContaining("Mercado Central"),
    ]);
    expect(list.textContent).toContain("installment 3 of 10");
    expect(within(list).queryByText("Outro cartão")).toBeNull();
    expect(screen.queryByText("Fatura de fevereiro")).toBeNull();
    expect(screen.getAllByText("Outro cartão")).toHaveLength(1);
  });

  it("lists a cycle's rows by posted day, those counting next month too", async () => {
    width(false);
    serve([{ ...CLOSED, fromBank: false, closed: false, heldFrom: "2029-12-20", heldTo: null }]);
    open();
    const list = await screen.findByRole("list", { name: "Transactions of Nubank in January 2030" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Geladeira Frost Free"),
      expect.stringContaining("Mercado Central"),
      expect.stringContaining("Fatura de fevereiro"),
    ]);
    expect(vi.mocked(api.getMonthTransactions).mock.calls.map(([m]) => m)).toEqual(["2030-01", "2030-02"]);
  });

  it("is a table on a desktop width", async () => {
    width(true);
    serve();
    open();
    const table = await screen.findByRole("table", { name: "Transactions of Nubank in January 2030" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("shows an empty state without cards and an error with retry", async () => {
    width(false);
    serve([]);
    open();
    expect(await screen.findByText("No card bills this month")).toBeTruthy();
  });

  it("reloads when the bills could not be read", async () => {
    width(false);
    serve();
    vi.mocked(api.getCardBills).mockRejectedValueOnce(new Error("down"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Nubank" })).toBeTruthy();
  });
});

describe("bill days", () => {
  it("saves both days and reads the screen again", async () => {
    width(false);
    serve();
    vi.mocked(api.putBillDays).mockResolvedValue({ kind: "ok" });
    const { client } = open();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: "Bill days: Itaú Visa" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Closing day" }), "5");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Due day" }), "12");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(api.putBillDays).toHaveBeenCalledWith("s2", 5, 12);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["finance", "status"], ["finance", "commitments"], ["finance", "transactions"]]);
    await waitFor(() => expect(api.getCardBills).toHaveBeenCalledTimes(2));
  });

  it("starts from the saved days and asks for the missing one", async () => {
    width(false);
    serve();
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Bill days: Nubank" }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("textbox", { name: "Closing day" }) as HTMLInputElement).value).toBe("8");
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Due day" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByText("Enter the due day.")).toBeTruthy();
    expect(api.putBillDays).not.toHaveBeenCalled();
  });

  it("stays open with a message when the API refuses", async () => {
    width(false);
    serve();
    vi.mocked(api.putBillDays).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Bill days: Nubank" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
  });
});

describe("accessibility", () => {
  const COMBOS = [["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const;
  const violations = async () =>
    (await axe.run(document.body, AXE)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  describe.each(COMBOS)("%s %s", (theme, locale) => {
    it.each([true, false])("screen, desktop %s", async (desktop) => {
      width(desktop);
      serve();
      open({ theme, locale });
      await screen.findByRole("heading", { name: "Nubank" });
      expect(await violations()).toEqual([]);
    });
    it("days sheet with errors", async () => {
      width(false);
      serve();
      open({ theme, locale });
      await userEvent.click((await screen.findAllByRole("button", { name: /^(Bill days|Dias da fatura)/ }))[0]!);
      await userEvent.clear(within(await screen.findByRole("dialog")).getByRole("textbox", { name: locale === "en" ? "Due day" : "Dia do vencimento" }));
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: locale === "en" ? "Save" : "Salvar" }));
      expect(await violations()).toEqual([]);
    });
  });
});
