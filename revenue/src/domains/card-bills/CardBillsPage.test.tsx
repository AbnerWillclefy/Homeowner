import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { CardBill, CardSource, CardTransaction, PastBills } from "./api";
import { CardBillsPage } from "./CardBillsPage";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getCardBills: vi.fn(), getCardSources: vi.fn(), getMonthTransactions: vi.fn(), getPastBills: vi.fn(), putBillDays: vi.fn(),
}));

const CLOSED: CardBill = { sourceId: "s1", name: "Nubank", amountCents: 284300, billDaysKnown: true, fromBank: true, dueOn: "2030-01-15", closesOn: "2030-01-08", closed: false, heldFrom: null, heldTo: null };
const OPEN: CardBill = { sourceId: "s2", name: "Itaú Visa", amountCents: 50000, billDaysKnown: false, fromBank: false, dueOn: null, closesOn: null, closed: false, heldFrom: null, heldTo: null };
const SOURCES: CardSource[] = [{ id: "s1", name: "Nubank", closeDay: 8, dueDay: 15, creditLimitCents: 1_000_000 }, { id: "s2", name: "Itaú Visa", closeDay: null, dueDay: null, creditLimitCents: null }];
const tx = (over: Partial<CardTransaction>): CardTransaction => ({ id: "t1", sourceId: "s1", description: "Mercado Central", postedOn: "2029-12-20", countsOn: "2030-01-15", amountCents: -28430, installment: null, spendingCategory: null, ...over });
const ROWS = [
  tx({}),
  tx({ id: "t2", description: "Geladeira Frost Free", postedOn: "2029-12-22", amountCents: -3249, installment: { number: 3, total: 10 } }),
  tx({ id: "t6", description: "Netflix", postedOn: "2029-12-25", amountCents: -4490, spendingCategory: "subscriptions" }),
  tx({ id: "t3", description: "Outro cartão", sourceId: "s2" }),
  tx({ id: "t4", description: "Fatura de fevereiro", countsOn: "2030-02-15" }),
  tx({ id: "t5", description: "Fatura de março", postedOn: "2029-12-30", countsOn: "2030-03-15" }),
];
const HISTORY: PastBills = {
  bills: ["2029-08", "2029-09", "2029-10", "2029-11", "2029-12", "2030-01"].map((m, i) => ({ closesOn: `${m}-08`, dueOn: `${m}-15`, totalCents: 100000 + i * 10000 })),
  averageCents: 125000,
};
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const serve = (cards: CardBill[] = [CLOSED, OPEN]) => {
  vi.mocked(api.getCardBills).mockResolvedValue(cards);
  vi.mocked(api.getCardSources).mockResolvedValue(SOURCES);
  vi.mocked(api.getMonthTransactions).mockImplementation(async (month: string) => ROWS.filter((r) => r.countsOn.startsWith(month)));
  vi.mocked(api.getPastBills).mockResolvedValue(HISTORY);
};
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<HideValuesProvider><CardBillsPage /></HideValuesProvider>, { path: "/card-bills", locale: "en", ...options });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  localStorage.clear();
  for (const fn of [api.getCardBills, api.getCardSources, api.getMonthTransactions, api.getPastBills, api.putBillDays]) vi.mocked(fn).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("layout", () => {
  it("heads the screen with the card count, the open total and one segment per card", async () => {
    width(true);
    serve();
    open();
    expect(await screen.findByText("Closed bill · Nubank")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Card bills" })).toBeTruthy();
    expect(screen.getByText(/^2 cards · R\$\s?500\.00 in open bills$/)).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "Card" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Nubank", "Itaú Visa"]);
    expect(screen.getByRole("combobox", { name: "Month" })).toBeTruthy();
  });

  it("puts the bill on the left of the 12-column grid and history and days on the right", async () => {
    width(true);
    serve();
    open();
    const bill = (await screen.findByText("Closed bill · Nubank")).closest("div[class*=border]") as HTMLElement;
    expect(bill.parentElement!.className).toContain("desktop:col-span-8");
    expect(bill.parentElement!.parentElement!.className).toContain("desktop:grid-cols-12");
    const history = screen.getByText("Recent bills").closest("div[class*=border]") as HTMLElement;
    expect(history.parentElement!.className).toContain("desktop:col-span-4");
    expect(within(history.parentElement!).getByText("Card dates")).toBeTruthy();
  });

  it("shows the card's name and no segment with a single card", async () => {
    width(true);
    serve([CLOSED]);
    open();
    expect(await screen.findByText("Closed bill · Nubank")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("1 card")).toBeTruthy();
  });

  it("puts the card segment under the header on a phone", async () => {
    width(false);
    serve();
    open();
    await screen.findByText("Closed bill · Nubank");
    expect(screen.getByRole("radiogroup", { name: "Card" })).toBeTruthy();
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
    expect(await screen.findByText("Closed bill · Nubank")).toBeTruthy();
  });
});

describe("the open bill", () => {
  it("calls a closed bill the bank's total, with its closing and due dates", async () => {
    width(true);
    serve();
    open();
    const card = (await screen.findByText("Closed bill · Nubank")).closest("div[class*=border]") as HTMLElement;
    expect(within(card).getByText("Total reported by the bank")).toBeTruthy();
    expect(card.textContent).toContain("2,843.00");
    expect(within(card).getByText(/^Closes/)).toBeTruthy();
    expect(within(card).getByText(/^Due/)).toBeTruthy();
  });

  it("calls an open bill the app's sum and says when days are missing, with no closing badge or due date", async () => {
    width(true);
    serve([OPEN]);
    open();
    const card = (await screen.findByText("Open bill · Itaú Visa")).closest("div[class*=border]") as HTMLElement;
    expect(within(card).getByText(/^App's sum/)).toBeTruthy();
    expect(within(card).getByText("No closing and due days yet")).toBeTruthy();
    expect(within(card).queryByText(/^Closes/)).toBeNull();
    expect(within(card).queryByText(/^Due/)).toBeNull();
  });

  it("calls a bill closed by the typed days closed, still the app's sum", async () => {
    width(true);
    serve([{ ...OPEN, billDaysKnown: true, closed: true, heldFrom: "2029-12-08", heldTo: "2030-01-08", closesOn: "2030-01-08", dueOn: "2030-01-15" }]);
    open();
    const card = (await screen.findByText("Closed bill · Itaú Visa")).closest("div[class*=border]") as HTMLElement;
    expect(within(card).getByText(/^App's sum/)).toBeTruthy();
    expect(within(card).getByText(/^Closes/)).toBeTruthy();
    expect(screen.queryByText("No closing and due days yet")).toBeNull();
  });

  it("says it in Portuguese first", async () => {
    width(true);
    serve();
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Fatura fechada · Nubank")).toBeTruthy();
    expect(screen.getByText("Total informado pelo banco")).toBeTruthy();
    expect(screen.getByText("Últimas faturas")).toBeTruthy();
  });

  it("splits the bill's rows into purchases, installments and subscriptions", async () => {
    width(true);
    serve([{ ...CLOSED, fromBank: false, heldFrom: "2029-12-20", heldTo: "2030-01-08" }]);
    open();
    const card = (await screen.findByText("Open bill · Nubank")).closest("div[class*=border]") as HTMLElement;
    const part = (name: string) => within(card).getByText(name).closest("div")!.textContent;
    expect(part("Purchases")).toContain("852.90");
    expect(part("Installments")).toContain("32.49");
    expect(part("Subscriptions")).toContain("44.90");
    expect(within(card).getByText("Sum of this bill's rows.")).toBeTruthy();
  });

  it("shows Limit used as used of limit, and no bar without a limit", async () => {
    width(true);
    serve();
    open();
    const bar = await screen.findByRole("progressbar", { name: "Limit used" });
    expect(bar.getAttribute("aria-valuetext")).toMatch(/^R\$\s?2,843\.00 of R\$\s?10,000\.00$/);
  });

  it("has no Limit used bar when the card has no limit", async () => {
    width(true);
    serve([OPEN]);
    open();
    await screen.findByText("Open bill · Itaú Visa");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("keeps the real numbers when the bill passes the limit", async () => {
    width(true);
    serve([{ ...CLOSED, amountCents: 1_500_000 }]);
    open();
    const bar = await screen.findByRole("progressbar", { name: "Limit used" });
    expect(bar.getAttribute("aria-valuetext")).toMatch(/15,000\.00 of R\$\s?10,000\.00$/);
  });
});

describe("the card in the URL", () => {
  it("selects the first card without ?card=, and the named one with it", async () => {
    width(true);
    serve();
    open();
    expect(await screen.findByText("Closed bill · Nubank")).toBeTruthy();
    expect(vi.mocked(api.getPastBills).mock.calls.map((c) => c[0])).toEqual(["s1"]);
  });

  it("opens the card in ?card= and keeps it with the month", async () => {
    width(true);
    serve();
    open({ path: "/card-bills?card=s2&month=2029-12" });
    expect(await screen.findByText("Open bill · Itaú Visa")).toBeTruthy();
    expect(vi.mocked(api.getCardBills).mock.calls[0]![0]).toBe("2029-12");
    expect(vi.mocked(api.getPastBills).mock.calls.at(-1)![0]).toBe("s2");
  });

  it("falls back to the first card when ?card= names none", async () => {
    width(true);
    serve();
    open({ path: "/card-bills?card=gone" });
    expect(await screen.findByText("Closed bill · Nubank")).toBeTruthy();
  });

  it("switching the segment changes the bill, its rows and the history request", async () => {
    width(true);
    serve();
    open();
    await screen.findByText("Closed bill · Nubank");
    await userEvent.click(screen.getByRole("radio", { name: "Itaú Visa" }));
    expect(await screen.findByText("Open bill · Itaú Visa")).toBeTruthy();
    expect(screen.getByText("Outro cartão")).toBeTruthy();
    expect(screen.queryByText("Mercado Central")).toBeNull();
    expect(vi.mocked(api.getPastBills).mock.calls.map((c) => c[0])).toEqual(["s1", "s2"]);
  });
});

describe("rows", () => {
  it("lists the card's rows counted in the month newest first, with category, date and installment tag", async () => {
    width(true);
    serve();
    open();
    const list = await screen.findByRole("list", { name: "Transactions of Nubank in January 2030" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Netflix"),
      expect.stringContaining("Geladeira Frost Free"),
      expect.stringContaining("Mercado Central"),
    ]);
    expect(within(list).getByText("3/10")).toBeTruthy();
    expect(within(list).getAllByText(/^Other/)).toHaveLength(2);
    expect(within(list).getByText(/^Subscriptions/)).toBeTruthy();
    expect(screen.getByText("3 Transactions")).toBeTruthy();
    expect(screen.queryByText("Fatura de fevereiro")).toBeNull();
  });

  it("lists a cycle's rows by posted day, those counting up to two months on too", async () => {
    width(true);
    serve([{ ...CLOSED, fromBank: false, closed: false, heldFrom: "2029-12-20", heldTo: null }]);
    open();
    const list = await screen.findByRole("list", { name: "Transactions of Nubank in January 2030" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Fatura de março"),
      expect.stringContaining("Netflix"),
      expect.stringContaining("Geladeira Frost Free"),
      expect.stringContaining("Mercado Central"),
      expect.stringContaining("Fatura de fevereiro"),
    ]);
    expect(vi.mocked(api.getMonthTransactions).mock.calls.map(([m]) => m)).toEqual(["2030-01", "2030-02", "2030-03"]);
  });

  it("says the rows could not be read, and shows no split", async () => {
    width(true);
    serve();
    vi.mocked(api.getMonthTransactions).mockRejectedValue(new Error("down"));
    open();
    expect(await screen.findByText("Could not load the Transactions.")).toBeTruthy();
    expect(screen.queryByText("Installments")).toBeNull();
  });
});

describe("recent bills", () => {
  it("shows the six bars and their average", async () => {
    width(true);
    serve();
    open();
    const chart = await screen.findByRole("img", { name: /^Bills from Aug to Jan, 6-month average/ });
    expect(chart).toBeTruthy();
    const table = within(chart.parentElement!).getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(6);
    expect(vi.mocked(api.getPastBills)).toHaveBeenCalledWith("s1");
    const average = screen.getByText("6-month average").parentElement!;
    expect(average.textContent).toContain("1,250.00");
  });

  it("says the bank sends no earlier bills for an empty list", async () => {
    width(true);
    serve();
    vi.mocked(api.getPastBills).mockResolvedValue({ bills: [], averageCents: null });
    open();
    expect(await screen.findByText("The bank does not send earlier bills.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Bills from/ })).toBeNull();
  });

  it("has its own retry when the history fails, not a page error", async () => {
    width(true);
    serve();
    vi.mocked(api.getPastBills).mockRejectedValueOnce(new Error("down"));
    open();
    expect(await screen.findByText("Could not load the earlier bills.")).toBeTruthy();
    expect(screen.getByText("Closed bill · Nubank")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("img", { name: /^Bills from/ })).toBeTruthy();
  });
});

describe("hide values", () => {
  it("masks the hero, split, rows, limit, open total and average", async () => {
    width(true);
    serve();
    localStorage.setItem("revenue.hideValues", "1");
    open();
    await screen.findByText("Closed bill · Nubank");
    expect(screen.getByText("2 cards")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/R\$\s?[\d.,]+/);
    expect(screen.getByRole("progressbar", { name: "Limit used" }).getAttribute("aria-valuetext")).toBe("hidden value");
    expect(await screen.findByRole("img", { name: /^Bills from Aug to Jan$/ })).toBeTruthy();
  });
});

describe("bill days", () => {
  it("starts from the card's saved days", async () => {
    width(true);
    serve();
    open();
    await screen.findByText("Card dates");
    expect((screen.getByRole("textbox", { name: "Closing day" }) as HTMLInputElement).value).toBe("8");
    expect((screen.getByRole("textbox", { name: "Due day" }) as HTMLInputElement).value).toBe("15");
  });

  it("saves both days and reads the screen again", async () => {
    width(true);
    serve([OPEN]);
    vi.mocked(api.putBillDays).mockResolvedValue({ kind: "ok" });
    const { client } = open();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.type(await screen.findByRole("textbox", { name: "Closing day" }), "5");
    await userEvent.type(screen.getByRole("textbox", { name: "Due day" }), "12");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.putBillDays).toHaveBeenCalledWith("s2", 5, 12);
    expect(await screen.findByText("Dates saved.")).toBeTruthy();
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["finance", "status"], ["finance", "commitments"], ["finance", "transactions"]]);
    await waitFor(() => expect(api.getCardBills).toHaveBeenCalledTimes(2));
  });

  it("asks for the missing day and does not save", async () => {
    width(true);
    serve();
    open();
    await userEvent.clear(await screen.findByRole("textbox", { name: "Due day" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter the due day.")).toBeTruthy();
    expect(api.putBillDays).not.toHaveBeenCalled();
  });

  it("shows the API's field errors", async () => {
    width(true);
    serve();
    vi.mocked(api.putBillDays).mockResolvedValue({ kind: "fields", fields: { closeDay: "invalid" } });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a day from 1 to 31.")).toBeTruthy();
  });

  it("keeps the values and says so when the API refuses", async () => {
    width(true);
    serve();
    vi.mocked(api.putBillDays).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    expect((screen.getByRole("textbox", { name: "Closing day" }) as HTMLInputElement).value).toBe("8");
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
      await screen.findAllByText(/Nubank/);
      expect(await violations()).toEqual([]);
    });
    it("days form with errors", async () => {
      width(true);
      serve();
      open({ theme, locale });
      await userEvent.clear(await screen.findByRole("textbox", { name: locale === "en" ? "Due day" : "Dia do vencimento" }));
      await userEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save" : "Salvar" }));
      expect(await violations()).toEqual([]);
    });
  });
});
