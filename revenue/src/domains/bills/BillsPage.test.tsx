import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { Bill, BillSuggestion, CardBill, WriteResult } from "./api";
import { BillsPage } from "./BillsPage";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getBills: vi.fn(), getBillSuggestions: vi.fn(), getCardBills: vi.fn(), saveBill: vi.fn(), deleteBill: vi.fn(), setBillPaid: vi.fn(), dismissBillSuggestion: vi.fn(),
}));

const bill = (over: Partial<Bill>): Bill => ({ id: "b1", name: "Aluguel", expectedCents: 320000, dueDay: 5, dueDate: "2030-01-05", paid: false, paidBy: null, paidCents: null, ...over });
const OVERDUE = bill({});
const PENDING = bill({ id: "b2", name: "Internet", expectedCents: 12990, dueDay: 25, dueDate: "2030-01-25" });
const PAID = bill({ id: "b3", name: "Condomínio", expectedCents: 85000, dueDay: 12, dueDate: "2030-01-12", paid: true, paidBy: "hand", paidCents: 85000 });
const BANK = bill({ id: "b4", name: "Luz", expectedCents: 21000, dueDay: 14, dueDate: "2030-01-14", paid: true, paidBy: "bank", paidCents: 21000 });
const LONG = bill({ id: "b5", name: "ASSINATURA ANUAL DO CLUBE DE BENEFÍCIOS COM NOME EXTREMAMENTE LONGO ".repeat(2).trim(), dueDay: 20, dueDate: "2030-01-20" });
const CARD: CardBill = { sourceId: "s1", name: "Nubank", amountCents: 284300, billDaysKnown: true };
const SUGGESTION: BillSuggestion = { merchantKey: "enel", name: "Enel", amountCents: 21480, dueDay: 10 };
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const serve = (bills: Bill[], extra: { cards?: CardBill[]; suggestions?: BillSuggestion[] } = {}) => {
  vi.mocked(api.getBills).mockResolvedValue(bills);
  vi.mocked(api.getCardBills).mockResolvedValue(extra.cards ?? []);
  vi.mocked(api.getBillSuggestions).mockResolvedValue(extra.suggestions ?? []);
};
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<BillsPage />, { path: "/bills", locale: "en", ...options });
const paid = vi.mocked(api.setBillPaid);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  localStorage.clear();
  for (const fn of [api.getBills, api.getBillSuggestions, api.getCardBills, api.saveBill, api.deleteBill, api.setBillPaid, api.dismissBillSuggestion]) vi.mocked(fn).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("layout and states", () => {
  it("is a table by due date on a desktop width, with the whole long name", async () => {
    width(true);
    serve([PENDING, LONG, OVERDUE]);
    open();
    const table = await screen.findByRole("table", { name: "Bills to pay of January 2030" });
    expect(within(table).getByText(LONG.name)).toBeTruthy();
    const names = within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1]!.textContent);
    expect(names[0]).toContain("Aluguel");
    expect(names[2]).toContain("Internet");
  });

  it("is a list on a phone width", async () => {
    width(false);
    serve([OVERDUE, PENDING]);
    open();
    expect(within(await screen.findByRole("list", { name: "Bills to pay of January 2030" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("opens on the month in the address and reads it", async () => {
    width(false);
    serve([OVERDUE]);
    open({ path: "/bills?month=2029-12" });
    await screen.findByText("Aluguel");
    expect(api.getBills).toHaveBeenCalledWith("2029-12");
    expect(screen.getByText("December 2029")).toBeTruthy();
  });

  it("says an empty month calmly", async () => {
    width(false);
    serve([]);
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Nenhuma conta neste mês")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error with a way to retry", async () => {
    width(false);
    serve([OVERDUE]);
    vi.mocked(api.getBills).mockRejectedValueOnce(new Error("down"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Aluguel")).toBeTruthy();
  });

  it("totals what is paid against what is left", async () => {
    width(false);
    serve([OVERDUE, PENDING, PAID]);
    open();
    expect(await screen.findByText(/paid of/)).toBeTruthy();
    expect(screen.getByText(/2 bills left/)).toBeTruthy();
  });
});

describe("statuses", () => {
  it.each([["pt-BR", ["Atrasada", "Pendente", "Paga"]], ["en", ["Overdue", "Pending", "Paid"]]] as const)("carry text in %s, calmly", async (locale, words) => {
    width(true);
    serve([OVERDUE, PENDING, PAID, BANK]);
    const { container } = open({ locale });
    await screen.findByRole("table");
    for (const word of words) expect(screen.getAllByText(word).length).toBeGreaterThan(0);
    expect(screen.getAllByText(words[2]!)).toHaveLength(2);
    expect(container.textContent).not.toContain("!");
    expect(container.querySelector(".text-danger, .bg-danger, .bg-danger-soft")).toBeNull();
    // Each badge has an icon as well as its word.
    expect(screen.getByText(words[0]!).querySelector("svg")).toBeTruthy();
  });

  it("names the day an overdue Bill was due", async () => {
    width(false);
    serve([OVERDUE]);
    open();
    expect(await screen.findByText(/Was due Jan 5/)).toBeTruthy();
  });

  it("counts today in São Paulo: a Bill due the 10th is not overdue at 02:00 UTC on the 11th", async () => {
    vi.setSystemTime(new Date("2030-01-11T02:00:00Z"));
    width(false);
    serve([bill({ dueDate: "2030-01-10", dueDay: 10 })]);
    open();
    expect(await screen.findByText("Pending")).toBeTruthy();
    expect(screen.queryByText("Overdue")).toBeNull();
  });
});

describe("card bills", () => {
  it("are listed with no edit, delete or pay action", async () => {
    width(true);
    serve([PENDING], { cards: [CARD] });
    open();
    const section = (await screen.findByRole("heading", { name: "Card bills" })).closest("section")!;
    expect(within(section).getByText("Nubank")).toBeTruthy();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
    expect(api.saveBill).not.toHaveBeenCalled();
  });

  it("are left out when there are none", async () => {
    width(true);
    serve([PENDING]);
    open();
    await screen.findByText("Internet");
    expect(screen.queryByRole("heading", { name: "Card bills" })).toBeNull();
  });
});

describe("a past month", () => {
  it("is read-only", async () => {
    width(true);
    serve([OVERDUE, PAID]);
    open({ path: "/bills?month=2029-12" });
    await screen.findByText("Aluguel");
    expect(screen.queryByRole("button", { name: /Mark paid|Undo|More actions/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add bill" })).toBeNull();
    expect(screen.queryByText("Overdue")).toBeNull();
  });
});

describe("mark paid and undo", () => {
  const row = (name: string) => screen.getByText(name).closest("tr")!;

  it("shows Paid before the API answers, then reads the finance views again", async () => {
    width(true);
    serve([PENDING]);
    let answer!: (r: WriteResult) => void;
    paid.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { client } = open();
    await screen.findByText("Internet");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(screen.getByRole("button", { name: /Mark paid/ }));
    expect(paid).toHaveBeenCalledWith("b2", "2030-01", true);
    await waitFor(() => expect(within(row("Internet")).getByText("Paid")).toBeTruthy());
    expect(within(row("Internet")).getByRole("button", { name: /Undo/ }).hasAttribute("disabled")).toBe(true);
    answer({ kind: "ok" });
    await waitFor(() => expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["finance", "bills"], ["finance", "commitments"], ["finance", "transactions"]]));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps each row's buttons disabled while its own write is pending", async () => {
    width(true);
    serve([PENDING, LONG]);
    const answers: ((r: WriteResult) => void)[] = [];
    paid.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    open();
    await screen.findByText("Internet");
    const buttons = screen.getAllByRole("button", { name: /Mark paid/ });
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
    const undo = () => screen.getAllByRole("button", { name: /Undo/ });
    await waitFor(() => expect(undo()).toHaveLength(2));
    expect(undo().every((b) => b.hasAttribute("disabled"))).toBe(true);
    answers[0]({ kind: "ok" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Mark paid|Undo/ }).filter((b) => b.hasAttribute("disabled"))).toHaveLength(1));
  });

  it("rolls the row back and says so when the API refuses", async () => {
    width(true);
    serve([PENDING]);
    paid.mockResolvedValue({ kind: "error" });
    open();
    await screen.findByText("Internet");
    await userEvent.click(screen.getByRole("button", { name: /Mark paid/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    expect(within(row("Internet")).getByText("Pending")).toBeTruthy();
    expect(within(row("Internet")).getByRole("button", { name: /Mark paid/ })).toBeTruthy();
  });

  it("undoes a paid mark, and rolls that back too", async () => {
    width(true);
    serve([PAID]);
    paid.mockResolvedValue({ kind: "error" });
    open();
    await screen.findByText("Condomínio");
    await userEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(paid).toHaveBeenCalledWith("b3", "2030-01", false);
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    expect(within(row("Condomínio")).getByText("Paid")).toBeTruthy();
  });

  it("says the Bill is gone and reads the month again when the API cannot find it", async () => {
    width(true);
    serve([PENDING]);
    paid.mockResolvedValue({ kind: "not-found" });
    open();
    await screen.findByText("Internet");
    await userEvent.click(screen.getByRole("button", { name: /Mark paid/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("no longer here");
    await waitFor(() => expect(api.getBills).toHaveBeenCalledTimes(2));
  });

  it("gives a Bill paid by the bank no Undo", async () => {
    width(true);
    serve([BANK]);
    open();
    await screen.findByText("Luz");
    expect(within(row("Luz")).queryByRole("button", { name: /Undo|Mark paid/ })).toBeNull();
    expect(within(row("Luz")).getByText("paid by the bank")).toBeTruthy();
  });
});

describe("the form", () => {
  const openAdd = async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Add bill" }));
    return screen.findByRole("dialog");
  };

  it("checks each field before sending", async () => {
    width(true);
    serve([PENDING]);
    open();
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByText("Give the bill a name.")).toBeTruthy();
    expect(within(dialog).getByText("Enter an amount above zero.")).toBeTruthy();
    expect(within(dialog).getByText("Enter a day from 1 to 31.")).toBeTruthy();
    expect(within(dialog).getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe("true");
    expect(api.saveBill).not.toHaveBeenCalled();
  });

  it("sends a new Bill and closes", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.saveBill).mockResolvedValue({ kind: "ok" });
    const { client } = open();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), " Gás ");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Amount" }), "123,45");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Due day" }), "7");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(api.saveBill).toHaveBeenCalledWith(null, { name: "Gás", expectedCents: 12345, dueDay: 7 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("shows the API's field codes beside their fields and stays open", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.saveBill).mockResolvedValue({ kind: "fields", fields: { name: "invalid", dueDay: "invalid", other: "x" } });
    open();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Gás");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Amount" }), "10");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Due day" }), "7");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("That name will not do. Try another.")).toBeTruthy();
    expect(within(dialog).getByText("Enter a day from 1 to 31.")).toBeTruthy();
    expect(within(dialog).getByRole("textbox", { name: "Amount" }).getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("says a failed save and keeps what was typed", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.saveBill).mockResolvedValue({ kind: "error" });
    open();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Gás");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Amount" }), "10");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Due day" }), "7");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("We could not save");
    expect((within(dialog).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Gás");
  });

  it("edits a Bill with its fields filled in", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.saveBill).mockResolvedValue({ kind: "ok" });
    open();
    await screen.findByText("Internet");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Internet" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Internet");
    expect((within(dialog).getByRole("textbox", { name: "Amount" }) as HTMLInputElement).value).toMatch(/129[.,]90/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(api.saveBill).toHaveBeenCalledWith("b2", { name: "Internet", expectedCents: 12990, dueDay: 25 });
  });
});

describe("delete", () => {
  it("asks first, then deletes", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.deleteBill).mockResolvedValue({ kind: "ok" });
    open();
    await screen.findByText("Internet");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Internet" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(api.deleteBill).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(api.deleteBill).toHaveBeenCalledWith("b2");
  });

  it("says so when the API refuses", async () => {
    width(true);
    serve([PENDING]);
    vi.mocked(api.deleteBill).mockResolvedValue({ kind: "error" });
    open();
    await screen.findByText("Internet");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Internet" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
  });
});

describe("suggestions", () => {
  it("add opens the form prefilled, and dismisses the suggestion once saved", async () => {
    width(true);
    serve([PENDING], { suggestions: [SUGGESTION] });
    vi.mocked(api.saveBill).mockResolvedValue({ kind: "ok" });
    vi.mocked(api.dismissBillSuggestion).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: /^Add: Enel/ }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Enel");
    expect((within(dialog).getByRole("spinbutton", { name: "Due day" }) as HTMLInputElement).value).toBe("10");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(api.saveBill).toHaveBeenCalledWith(null, { name: "Enel", expectedCents: 21480, dueDay: 10 });
    await waitFor(() => expect(api.dismissBillSuggestion).toHaveBeenCalledWith("enel"));
  });

  it("dismiss hides it at once and brings it back with an error when refused", async () => {
    width(true);
    serve([PENDING], { suggestions: [SUGGESTION] });
    vi.mocked(api.dismissBillSuggestion).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: /^Dismiss: Enel/ }));
    expect(api.dismissBillSuggestion).toHaveBeenCalledWith("enel");
    expect((await screen.findByRole("alert")).textContent).toContain("Could not dismiss");
    expect(screen.getByText("Enel")).toBeTruthy();
  });

  it("are not offered in a past month", async () => {
    width(true);
    serve([PENDING], { suggestions: [SUGGESTION] });
    open({ path: "/bills?month=2029-12" });
    await screen.findByText("Internet");
    expect(screen.queryByText("Enel")).toBeNull();
  });
});

describe("accessibility", () => {
  const COMBOS = [["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const;
  const violations = async () =>
    (await axe.run(document.body, AXE)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  describe.each(COMBOS)("%s %s", (theme, locale) => {
    it.each([true, false])("screen, desktop %s", async (desktop) => {
      width(desktop);
      serve([OVERDUE, PENDING, PAID, BANK, LONG], { cards: [CARD], suggestions: [SUGGESTION] });
      open({ theme, locale });
      await screen.findByText("Condomínio");
      expect(await violations()).toEqual([]);
    });
    it("form sheet with errors", async () => {
      width(false);
      serve([PENDING]);
      open({ theme, locale });
      await userEvent.click(await screen.findByRole("button", { name: locale === "en" ? "Add bill" : "Adicionar conta" }));
      await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: locale === "en" ? "Save" : "Salvar" }));
      expect(await violations()).toEqual([]);
    });
    it("delete dialog", async () => {
      width(true);
      serve([PENDING]);
      open({ theme, locale });
      await screen.findByText("Internet");
      await userEvent.click(screen.getByRole("button", { name: locale === "en" ? "More actions for Internet" : "Mais ações de Internet" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: locale === "en" ? "Delete" : "Excluir" }));
      await screen.findByRole("alertdialog");
      expect(await violations()).toEqual([]);
    });
  });
});
