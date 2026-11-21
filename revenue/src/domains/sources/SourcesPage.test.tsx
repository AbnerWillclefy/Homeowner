import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { BankItem, ManualCard, Source, SourcesStatus } from "./api";
import * as goalsApi from "../goals/api";
import type { Investment, Savings } from "../goals/api";
import * as overviewApi from "../overview/api/api";
import { HIDE_VALUES_STORAGE_KEY, HideValuesProvider } from "../../shared/HideValues";
import { addMonths, monthLabel, saoPauloDay } from "../../shared/month/month";
import type { PluggyOptions } from "./logic/pluggyConnect";
import { SourcesPage } from "./SourcesPage";

vi.mock("../goals/api", async (original) => ({ ...(await original<typeof import("../goals/api")>()), getSavings: vi.fn(), saveInvestment: vi.fn(), deleteInvestment: vi.fn(), putInvestmentServes: vi.fn(), restoreBankValue: vi.fn() }));
vi.mock("../overview/api/api", async (original) => ({ ...(await original<typeof import("../overview/api/api")>()), getCommitments: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getSources: vi.fn(), getManualCards: vi.fn(), saveManualCard: vi.fn(), deleteManualCard: vi.fn(), createConnectToken: vi.fn(), registerItem: vi.fn(), putSourceName: vi.fn() }));
let widget: PluggyOptions;
vi.mock("./logic/pluggyConnect", () => ({ openPluggyConnect: vi.fn(async (o: PluggyOptions) => void (widget = o)) }));

afterEach(() => vi.unstubAllGlobals());
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const base = { bankName: "Itaú", currency: "BRL", closeDay: null, dueDay: null };
const CHECKING: Source = { ...base, id: "s1", name: "Itaú", kind: "checking", balanceCents: 123_456, balanceOn: "2026-11-08" };
const NEVER: Source = { ...base, id: "s2", name: "Poupança Itaú", kind: "savings" };
const CARD: Source = { ...base, id: "s3", name: "Nubank", bankName: "Nubank", kind: "credit_card", closeDay: 8, dueDay: 15, creditLimitCents: 1_200_000 };
const NO_LIMIT: Source = { ...base, id: "s4", name: "Itaú Visa", kind: "credit_card" };
const ITEMS: BankItem[] = [{ id: "i1", bankName: "Nubank", status: "ok", products: 1 }, { id: "i2", bankName: "Itaú", status: "reconnect", products: 2 }];
const status = (sources: Source[], over: Partial<SourcesStatus> = {}): SourcesStatus => ({ sources, items: [], importing: false, lastSyncedAt: "2026-11-08T13:05:00Z", ...over });
const investment = (over: Partial<Investment>): Investment => ({ id: "i1", name: "Tesouro Selic", valueCents: 250_000, serves: "reserve", source: "hand", reportedByBank: true, edited: false, bankValueCents: null, ...over });
const HAND = investment({});
const BANK_NEW = investment({ id: "i2", name: "CDB Banco", valueCents: 80_000, serves: null, source: "pluggy", bankValueCents: 80_000 });
const BANK_EDITED = investment({ id: "i3", name: "Fundo", valueCents: 120_000, serves: "goals", source: "pluggy", edited: true, bankValueCents: 100_000 });
const savings = (investments: Investment[] = []): Savings => ({
  reserveTargetCents: null, contributionBaseCents: null, reserveSharePercent: null,
  reserve: { targetCents: null, savedCents: 0, monthCents: null, expectedMonth: null }, goals: [], investments, unassignedCents: 0,
});
const ok = { kind: "ok" } as const;
const THIS_MONTH = saoPauloDay(new Date()).slice(0, 7);
const NEXT_MONTH = addMonths(THIS_MONTH, 1);
const MANUAL: ManualCard = { id: "m1", name: "Fatura Naiara", dueDay: 10, pixRecipient: "Naiara Souza", bills: { [THIS_MONTH]: 110_900 } };

beforeEach(() => {
  // A wide screen, where Menu is a dropdown and not a Sheet.
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  localStorage.clear();
  for (const fn of [goalsApi.saveInvestment, goalsApi.deleteInvestment, goalsApi.putInvestmentServes, goalsApi.restoreBankValue, api.registerItem, api.putSourceName, api.getManualCards, api.saveManualCard, api.deleteManualCard]) vi.mocked(fn).mockReset();
  vi.mocked(api.getManualCards).mockResolvedValue([]);
  vi.mocked(goalsApi.getSavings).mockResolvedValue(savings([HAND, BANK_NEW, BANK_EDITED]));
  vi.mocked(overviewApi.getCommitments).mockImplementation(async (from) => ({
    monthlyIncomeCents: 0,
    months: [{ month: from, cards: [{ sourceId: "s3", name: "Nubank", amountCents: 241_822, billDaysKnown: true }, { sourceId: "m1", name: "Fatura Naiara", amountCents: 110_900, billDaysKnown: true, manual: true }] }],
  } as never));
  vi.mocked(api.getSources).mockResolvedValue(status([CHECKING, NEVER, CARD, NO_LIMIT], { items: ITEMS }));
  vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "ok", connectToken: "tok", includeSandbox: false });
});

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <HideValuesProvider>
      <Routes>
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/settings" element={<p>settings page</p>} />
        <Route path="/card-bills" element={<p>card bills page</p>} />
      </Routes>
    </HideValuesProvider>,
    { path: "/sources", locale: "en", ...options },
  );
const card = async (name: string) => within(await screen.findByRole("group", { name }));
const row = async (group: string, name: string) => (await card(group)).getByText(name).closest("li")!;

describe("the three cards", () => {
  it("lists the accounts with their balance, its day and the total", async () => {
    open();
    const accounts = await card("Checking accounts");
    expect(accounts.getAllByText("R$1,234.56")).toHaveLength(2); // the total and the row
    const itau = within(await row("Checking accounts", "Itaú"));
    expect(itau.getByText("R$1,234.56")).toBeTruthy();
    expect(itau.getByText("available balance")).toBeTruthy();
    expect(itau.getByText(/updated on Nov 8, 2026/)).toBeTruthy();
  });

  it("says 'no balance yet', not zero, for an account never synced", async () => {
    open();
    const r = within(await row("Checking accounts", "Poupança Itaú"));
    expect(r.getByText("no balance yet")).toBeTruthy();
    expect(r.queryByText(/0,00|0\.00/)).toBeNull();
  });

  it("shows a card's limit, closing day and open bill, linking to Faturas", async () => {
    open();
    const r = within(await row("Credit cards", "Nubank"));
    expect(r.getByText("Limit R$12,000 · closes on day 8")).toBeTruthy();
    expect(r.getByText("R$2,418.22")).toBeTruthy();
    expect(r.getByText("open bill")).toBeTruthy();
    await userEvent.click(r.getByRole("link"));
    expect(screen.getByText("card bills page")).toBeTruthy();
  });

  it("leaves out the limit and the closing day it does not have, and the bill the month has none of", async () => {
    open();
    const r = within(await row("Credit cards", "Itaú Visa"));
    expect(r.queryByText(/Limit|closes/)).toBeNull();
    expect(r.queryByText("open bill")).toBeNull();
  });

  it("writes it in Portuguese", async () => {
    open({ locale: "pt-BR" });
    expect(await screen.findByRole("group", { name: "Contas correntes" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Cartões de crédito" })).toBeTruthy();
    expect(within(await row("Cartões de crédito", "Nubank")).getByText("Limite R$ 12.000 · fecha dia 8")).toBeTruthy();
    expect(screen.getByText("sem saldo ainda")).toBeTruthy();
  });
});

describe("manual cards", () => {
  const field = (form: ReturnType<typeof within>, month: string) => form.getByRole("textbox", { name: monthLabel(month, "en") });

  it("offers to add one when there are no cards at all", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING]));
    open();
    const cards = await card("Credit cards");
    expect(cards.getByRole("button", { name: "Add a card by hand" })).toBeTruthy();
    expect(cards.queryByRole("listitem")).toBeNull();
  });

  it("lists them after the connected cards with the month's bill and no link to Card bills", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL, { ...MANUAL, id: "m2", name: "Cartão da Ana", dueDay: 3 }]);
    open();
    const r = within(await row("Credit cards", "Fatura Naiara"));
    expect(r.getByText("Typed bill · due on day 10")).toBeTruthy();
    expect(r.getByText("R$1,109.00")).toBeTruthy();
    expect(r.getByText("this month's bill")).toBeTruthy();
    expect(r.queryByRole("link")).toBeNull();
    const names = (await card("Credit cards")).getAllByRole("listitem").map((li) => li.querySelector(".body-strong")?.textContent);
    expect(names).toEqual(["Nubank", "Itaú Visa", "Fatura Naiara", "Cartão da Ana"]);
  });

  it("counts a manual card in the group's total", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    open();
    expect((await card("Credit cards")).getAllByText("R$3,527.22")).toHaveLength(1); // 2,418.22 + 1,109.00
  });

  it("hides the row's amount with the toggle", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    open();
    const r = await row("Credit cards", "Fatura Naiara");
    await waitFor(() => expect(r.textContent).not.toMatch(/\d,\d{2}/));
    expect(r.textContent).toContain("hidden value");
  });

  it("says a failed read, with Retry, and still offers to add", async () => {
    vi.mocked(api.getManualCards).mockRejectedValueOnce(new Error("x")).mockResolvedValue([MANUAL]);
    open();
    const cards = await card("Credit cards");
    expect(await cards.findByText(/Could not load the hand-typed cards/)).toBeTruthy();
    expect(cards.getByRole("button", { name: "Add a card by hand" })).toBeTruthy();
    await userEvent.click(cards.getByRole("button", { name: "Try again" }));
    expect(await cards.findByText("Typed bill · due on day 10")).toBeTruthy();
  });

  it("writes it in Portuguese", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    open({ locale: "pt-BR" });
    const r = within(await row("Cartões de crédito", "Fatura Naiara"));
    expect(r.getByText("Fatura digitada · vence dia 10")).toBeTruthy();
    expect((await card("Cartões de crédito")).getByRole("button", { name: "Adicionar cartão à mão" })).toBeTruthy();
  });

  it("saves a new card, an empty month going as null", async () => {
    vi.mocked(api.saveManualCard).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add a card by hand" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Fatura Naiara");
    await userEvent.type(form.getByRole("spinbutton", { name: /Due day/ }), "10");
    await userEvent.type(field(form, THIS_MONTH), "1190");
    await userEvent.type(form.getByRole("textbox", { name: /Pix to/ }), "Naiara Souza");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveManualCard).toHaveBeenCalledTimes(1));
    const [id, input] = vi.mocked(api.saveManualCard).mock.calls[0]!;
    expect(id).toBeNull();
    expect(input).toMatchObject({ name: "Fatura Naiara", dueDay: 10, pixRecipient: "Naiara Souza" });
    expect(input.bills[THIS_MONTH]).toBe(119_000);
    expect(input.bills[NEXT_MONTH]).toBeNull();
    expect(Object.keys(input.bills)).toHaveLength(12);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("edits a card from its row and sends the typed months it had", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    vi.mocked(api.saveManualCard).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("Credit cards", "Fatura Naiara")).getByRole("button", { name: "Edit Fatura Naiara" }));
    const form = within(await screen.findByRole("dialog"));
    expect((form.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Fatura Naiara");
    expect((field(form, THIS_MONTH) as HTMLInputElement).value).toBe("1,109.00");
    expect(field(form, THIS_MONTH).closest("fieldset")!.querySelectorAll("input")).toHaveLength(12);
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveManualCard).toHaveBeenCalledWith("m1", expect.objectContaining({ pixRecipient: "Naiara Souza", bills: expect.objectContaining({ [THIS_MONTH]: 110_900 }) })));
  });

  it("keeps what was typed and says so when the save fails", async () => {
    vi.mocked(api.saveManualCard).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add a card by hand" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Fatura Naiara");
    await userEvent.type(form.getByRole("spinbutton", { name: /Due day/ }), "10");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(await form.findByText(/We could not save/)).toBeTruthy();
    expect((form.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Fatura Naiara");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows the API's refusal beside the field and stays open", async () => {
    vi.mocked(api.saveManualCard).mockResolvedValue({ kind: "fields", fields: { name: "invalid" } });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add a card by hand" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Fatura");
    await userEvent.type(form.getByRole("spinbutton", { name: /Due day/ }), "10");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(await form.findByText("That name will not do. Try another.")).toBeTruthy();
  });

  it("checks the name and the day before sending", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add a card by hand" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(form.getByText("Give the bill a name.")).toBeTruthy();
    expect(form.getByText("Enter a day from 1 to 31.")).toBeTruthy();
    expect(api.saveManualCard).not.toHaveBeenCalled();
  });

  it("asks twice before deleting, then deletes", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    vi.mocked(api.deleteManualCard).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(within(await row("Credit cards", "Fatura Naiara")).getByRole("button", { name: "Edit Fatura Naiara" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.click(form.getByRole("button", { name: "Delete card" }));
    expect(api.deleteManualCard).not.toHaveBeenCalled();
    await userEvent.click(form.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(api.deleteManualCard).toHaveBeenCalledWith("m1"));
  });

  it("has no Delete button on a new card", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add a card by hand" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("button", { name: "Delete card" })).toBeNull();
  });

  it("has no accessibility violations with the sheet open", async () => {
    vi.mocked(api.getManualCards).mockResolvedValue([MANUAL]);
    open({ locale: "pt-BR" });
    await userEvent.click(within(await row("Cartões de crédito", "Fatura Naiara")).getByRole("button", { name: "Editar Fatura Naiara" }));
    const dialog = await screen.findByRole("dialog");
    expect((await axe.run(dialog, AXE)).violations).toEqual([]);
  });
});

describe("connected banks", () => {
  it("shows Ok and Reconectar with the product count, and explains the one to reconnect", async () => {
    open();
    const banks = await card("Connected banks");
    const nu = within(banks.getByText("Nubank").closest("li")!);
    expect(nu.getByText("Ok")).toBeTruthy();
    expect(nu.getByText("1 product")).toBeTruthy();
    const itau = within(banks.getByText("Itaú").closest("li")!);
    expect(itau.getByText("Reconnect")).toBeTruthy();
    expect(itau.getByText("2 products")).toBeTruthy();
    expect(banks.getByText(/asked for a new authorization/)).toBeTruthy();
    expect(banks.queryByRole("button")).toBeNull();
  });

  it("hides the card when the API sends no items", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING]));
    open();
    await screen.findByText("Checking accounts");
    expect(screen.queryByRole("group", { name: "Connected banks" })).toBeNull();
  });

  it("counts the banks and says how long ago it synced in the header", async () => {
    open();
    expect(await screen.findByText(/^2 banks connected through Open Finance · updated /)).toBeTruthy();
  });

  it("says the app only reads", async () => {
    open();
    expect(await screen.findByText(/The app only reads/)).toBeTruthy();
  });
});

describe("Investments", () => {
  it("lists them with the total and where each comes from", async () => {
    open();
    const inv = await card("Investments");
    expect(inv.getByText("R$4,500.00")).toBeTruthy();
    expect(inv.getByText("Tesouro Selic")).toBeTruthy();
    expect(within(await row("Investments", "CDB Banco")).getByText("From the bank")).toBeTruthy();
  });

  it("takes the bank's value back for an edited one", async () => {
    vi.mocked(goalsApi.restoreBankValue).mockResolvedValue(ok);
    open();
    const r = within(await row("Investments", "Fundo"));
    expect(r.getByText("bank: R$1,000.00")).toBeTruthy();
    await userEvent.click(r.getByRole("button", { name: "Use the bank's value for Fundo" }));
    expect(goalsApi.restoreBankValue).toHaveBeenCalledWith("i3");
  });

  it("sends the pick of a bank Investment", async () => {
    vi.mocked(goalsApi.putInvestmentServes).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("Investments", "CDB Banco")).getByRole("radio", { name: "Goals" }));
    expect(goalsApi.putInvestmentServes).toHaveBeenCalledWith("i2", "goals");
  });

  it("adds one by hand", async () => {
    vi.mocked(goalsApi.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add investment" }));
    const form = within(await screen.findByRole("dialog"));
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), " Poupança ");
    await userEvent.type(form.getByRole("textbox", { name: "Value" }), "0");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(goalsApi.saveInvestment).toHaveBeenCalledWith(null, { name: "Poupança", valueCents: 0, serves: "reserve" });
  });

  it("asks before deleting a hand-typed one, then deletes", async () => {
    vi.mocked(goalsApi.deleteInvestment).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(within(await row("Investments", "Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(goalsApi.deleteInvestment).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(goalsApi.deleteInvestment).toHaveBeenCalledWith("i1");
  });

  it("says a bank Investment with nothing picked is waiting, and that it counts toward neither", async () => {
    open();
    const r = within(await row("Investments", "CDB Banco"));
    expect(r.getByText("Choose what it is for")).toBeTruthy();
    expect(r.getByText(/counts toward neither the reserve nor your goals/)).toBeTruthy();
    expect(r.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  it("says it in Portuguese with the approved wording", async () => {
    open({ locale: "pt-BR" });
    expect(within(await row("Investimentos", "CDB Banco")).getByText("Escolha para quê serve")).toBeTruthy();
  });

  it("keeps a row the bank no longer reports, with a calm note, and no edited label on an untouched bank value", async () => {
    vi.mocked(goalsApi.getSavings).mockResolvedValue(savings([investment({ id: "i4", name: "LCI Antiga", valueCents: 5_000, source: "pluggy", reportedByBank: false, bankValueCents: 5_000 })]));
    open();
    const r = within(await row("Investments", "LCI Antiga"));
    expect(r.getByText("The bank no longer reports this.")).toBeTruthy();
    expect(r.queryByText("edited")).toBeNull();
    expect(r.queryByRole("button", { name: /Use the bank/ })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says a failed pick and changes nothing", async () => {
    vi.mocked(goalsApi.putInvestmentServes).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(within(await row("Investments", "CDB Banco")).getByRole("radio", { name: "Goals" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
  });

  it("gives a hand-typed row edit and delete, and a bank row edit without delete", async () => {
    open();
    await userEvent.click(within(await row("Investments", "Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(await row("Investments", "Fundo")).getByRole("button", { name: "More actions for Fundo" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("shows what is wrong beside the fields and sends nothing", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add investment" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }));
    expect(goalsApi.saveInvestment).not.toHaveBeenCalled();
    expect(within(await screen.findByRole("dialog")).getByText("Enter a name.")).toBeTruthy();
  });

  it("edits a hand-typed Investment", async () => {
    vi.mocked(goalsApi.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("Investments", "Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const form = within(await screen.findByRole("dialog"));
    expect((form.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Tesouro Selic");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(goalsApi.saveInvestment).toHaveBeenCalledWith("i1", { name: "Tesouro Selic", valueCents: 250_000, serves: "reserve" });
  });

  it("corrects only the value of a bank Investment, keeping its name and pick", async () => {
    vi.mocked(goalsApi.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("Investments", "Fundo")).getByRole("button", { name: "More actions for Fundo" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const form = within(await screen.findByRole("dialog"));
    expect(form.queryByRole("textbox", { name: "Name" })).toBeNull();
    const value = form.getByRole("textbox", { name: "Value" });
    await userEvent.clear(value);
    await userEvent.type(value, "70");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(goalsApi.saveInvestment).toHaveBeenCalledWith("i3", { name: "Fundo", valueCents: 7_000, serves: "goals" });
  });

  it("invites the first one calmly, and fails on its own without taking the Sources down", async () => {
    vi.mocked(goalsApi.getSavings).mockResolvedValueOnce(savings());
    const { unmount } = open();
    expect(await screen.findByText("No investments yet.")).toBeTruthy();
    unmount();
    vi.mocked(goalsApi.getSavings).mockRejectedValue(new Error("down"));
    open();
    expect(await screen.findByText("Could not load your investments.")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Checking accounts" })).toBeTruthy();
  });
});

describe("hiding values", () => {
  it("masks balances, totals, limits, investment values, bank values and open bills", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    const { container } = open();
    await screen.findByRole("group", { name: "Credit cards" });
    await screen.findByText("Fundo");
    await waitFor(() => expect(screen.getByText(/Limit hidden value/)).toBeTruthy());
    expect(container.textContent).toContain("bank: hidden value");
    expect(container.textContent).not.toMatch(/R\$\s?\d|\d,\d{2}/);
  });
});

describe("states", () => {
  it("invites the first connection when there are no Sources", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([], { lastSyncedAt: null }));
    open();
    expect(await screen.findByText("No Sources yet. Connect a bank to start.")).toBeTruthy();
  });

  it("offers Try again when the list fails to load", async () => {
    vi.mocked(api.getSources).mockRejectedValueOnce(new Error("down"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Itaú Visa")).toBeTruthy();
  });

  it("says when the banks are importing", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING], { importing: true }));
    open();
    expect(await screen.findByText("Importing your transactions…")).toBeTruthy();
  });
});

describe("connecting", () => {
  it("opens Pluggy Connect and shows the new Source once the Item is registered", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([]));
    vi.mocked(api.registerItem).mockResolvedValue({ kind: "ok", status: status([CHECKING]) });
    open();
    // The refresh after registering reads what the API now holds.
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING]));
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    expect(widget).toMatchObject({ connectToken: "tok", includeSandbox: false });
    await widget.onSuccess({ item: { id: "item-1" } });
    expect(api.registerItem).toHaveBeenCalledWith("item-1");
    expect(await screen.findByText("Itaú")).toBeTruthy();
  });

  it("says nothing was connected when the widget is closed", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    widget.onClose();
    expect(await screen.findByText(/Nothing was connected/)).toBeTruthy();
  });

  it.each([
    [{ kind: "unavailable" }, "Pluggy did not answer just now. Try again later."],
    [{ kind: "offline" }, "Cannot reach the service. Check your connection and try again."],
    [{ kind: "rejected" }, "Pluggy did not accept your credentials. Replace them in Settings."],
  ] as const)("words the token failure %j", async (token, text) => {
    vi.mocked(api.createConnectToken).mockResolvedValue(token);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    expect(await screen.findByText(new RegExp(text.slice(0, 30)))).toBeTruthy();
  });

  it("links to Settings, which owns the credentials form, when none are saved", async () => {
    vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "no-credentials" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await userEvent.click(await screen.findByRole("link", { name: "Open Settings" }));
    expect(screen.getByText("settings page")).toBeTruthy();
  });

  it("words a refused Item", async () => {
    vi.mocked(api.registerItem).mockResolvedValue({ kind: "item-refused" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    await widget.onSuccess({ item: { id: "i" } });
    expect(await screen.findByText(/Pluggy could not connect that bank/)).toBeTruthy();
  });
});

describe("naming", () => {
  it("renames a Source and shows the new name", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    const field = screen.getByLabelText("Name");
    await userEvent.clear(field);
    await userEvent.type(field, "  Cartão roxo ");
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING, NEVER, { ...CARD, name: "Cartão roxo" }]));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.putSourceName).toHaveBeenCalledWith("s3", "Cartão roxo");
    expect(await screen.findByText("Cartão roxo")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Rename Cartão roxo" })).toBe(document.activeElement));
  });

  it("refuses an empty name without calling the API", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(api.putSourceName).not.toHaveBeenCalled();
  });

  it("shows the API's word for a name that is too long", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "fields", fields: { name: "too_long" } });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Use up to 60 characters.")).toBeTruthy();
  });

  it("sends null to go back to the bank's name", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Poupança Itaú" }));
    await userEvent.click(screen.getByRole("button", { name: "Use the bank's name" }));
    expect(api.putSourceName).toHaveBeenCalledWith("s2", null);
  });
});

describe("accessibility", () => {
  it.each([
    ["en", "light"],
    ["en", "dark"],
    ["pt-BR", "light"],
    ["pt-BR", "dark"],
  ] as const)("has no violations in %s, %s theme", async (locale, theme) => {
    const { container } = open({ locale, theme });
    await screen.findByText("Fundo");
    await screen.findByText("Itaú Visa");
    expect((await axe.run(container, AXE)).violations).toEqual([]);
  });

  it("has none in the failure and empty states", async () => {
    vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "no-credentials" });
    const { container } = open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await screen.findByRole("link", { name: "Open Settings" });
    expect((await axe.run(container, AXE)).violations).toEqual([]);
  });
});
