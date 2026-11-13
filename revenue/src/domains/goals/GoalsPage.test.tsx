import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { Investment, Savings, SavingsGoal, WriteResult } from "./api";
import { GoalsPage } from "./GoalsPage";
import { savingsKey } from "./hooks/useSavings";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getSavings: vi.fn(), saveGoal: vi.fn(), deleteGoal: vi.fn(), putGoalOrder: vi.fn(), putReserve: vi.fn(), putContribution: vi.fn(),
  saveInvestment: vi.fn(), deleteInvestment: vi.fn(), putInvestmentServes: vi.fn(), restoreBankValue: vi.fn(),
}));

const goal = (over: Partial<SavingsGoal>): SavingsGoal => ({
  id: "g1", name: "Reforma", targetCents: 500000, targetMonth: null, savedCents: 100000, monthCents: 20000, expectedMonth: "2028-01", late: false, ...over,
});
const REFORMA = goal({});
const VIAGEM = goal({ id: "g2", name: "Viagem", targetCents: 800000, targetMonth: "2027-07", savedCents: 0, monthCents: 10000, expectedMonth: "2029-03", late: true });
const CARRO = goal({ id: "g3", name: "Carro", targetCents: 3000000, savedCents: 3000000, monthCents: 0, expectedMonth: null });
const LONG = goal({ id: "g4", name: "Troca de todos os móveis da casa inteira por modelos novos e muito caros ".repeat(2).trim() });
const investment = (over: Partial<Investment>): Investment => ({
  id: "i1", name: "Tesouro Selic", valueCents: 250000, serves: "reserve", source: "hand", reportedByBank: true, edited: false, bankValueCents: null, ...over,
});
const HAND = investment({});
const BANK_NEW = investment({ id: "i2", name: "CDB Banco", valueCents: 80000, serves: null, source: "pluggy", bankValueCents: 80000 });
const BANK_EDITED = investment({ id: "i3", name: "Fundo", valueCents: 120000, serves: "goals", source: "pluggy", edited: true, bankValueCents: 100000 });
const BANK_GONE = investment({ id: "i4", name: "LCI Antiga", valueCents: 5000, serves: "reserve", source: "pluggy", reportedByBank: false, bankValueCents: 5000 });
const WITH_INVESTMENTS = { investments: [HAND, BANK_NEW, BANK_EDITED, BANK_GONE] };
const SAVINGS: Savings = {
  reserveTargetCents: 900000, contributionBaseCents: 100000, reserveSharePercent: 30,
  reserve: { targetCents: 900000, savedCents: 300000, monthCents: 30000, expectedMonth: "2029-04" },
  goals: [REFORMA, VIAGEM, CARRO], investments: [], unassignedCents: 0,
};
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

afterEach(() => vi.unstubAllGlobals());

const serve = (savings: Savings = SAVINGS) => vi.mocked(api.getSavings).mockResolvedValue(savings);
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<GoalsPage />, { path: "/goals", locale: "en", ...options });
const order = (list: HTMLElement) => within(list).getAllByRole("listitem").map((li) => li.querySelector(".body-strong")?.textContent);
const ok: WriteResult = { kind: "ok" };

// A wide screen, where Menu is a dropdown and not a Sheet.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  localStorage.clear();
  for (const fn of [api.getSavings, api.saveGoal, api.deleteGoal, api.putGoalOrder, api.putReserve, api.putContribution, api.saveInvestment, api.deleteInvestment, api.putInvestmentServes, api.restoreBankValue]) vi.mocked(fn).mockReset();
});

describe("the screen", () => {
  it("shows the contribution split, the reserve and each Goal with its amounts as text beside the bar", async () => {
    serve();
    open();
    expect(await screen.findByText(/Emergency reserve \(30%\)/)).toBeTruthy();
    const list = await screen.findByRole("list", { name: "Goals" });
    const reforma = within(list).getAllByRole("listitem")[0]!;
    expect(within(reforma).getByText(/R\$1,000\.00 of R\$5,000\.00/)).toBeTruthy();
    expect(within(reforma).getByText("20%")).toBeTruthy();
    expect(within(reforma).getByRole("progressbar", { name: "Progress of Reforma" })).toBeTruthy();
    expect(screen.getByText(/Emergency reserve \(30%\)/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Emergency reserve progress" })).toBeTruthy();
  });

  it("says a Goal behind its date plainly: expected month, no alarm, no countdown", async () => {
    serve();
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    const viagem = within(list).getAllByRole("listitem")[1]!;
    expect(within(viagem).getByText("Expected in March 2029")).toBeTruthy();
    expect(viagem.textContent).not.toMatch(/late|behind|overdue|days|left/i);
    expect(viagem.querySelector("[class*=danger],[class*=warning]")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("draws a Goal nearly full without a warning colour", async () => {
    serve({ ...SAVINGS, goals: [goal({ savedCents: 480000 })] });
    const { container } = open();
    await screen.findByText("Reforma");
    expect(container.querySelector(".bg-warning, .bg-danger")).toBeNull();
  });

  it("says a Goal already full is reached", async () => {
    serve();
    open();
    expect(await screen.findByText("Target reached")).toBeTruthy();
  });

  it("invites the first Goal and the first contribution calmly", async () => {
    serve({ ...SAVINGS, reserveTargetCents: null, contributionBaseCents: null, reserveSharePercent: null, reserve: { targetCents: null, savedCents: 0, monthCents: null, expectedMonth: null }, goals: [] });
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Nenhum objetivo ainda")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Definir aporte" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Definir meta" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error with a way to retry", async () => {
    serve();
    vi.mocked(api.getSavings).mockRejectedValueOnce(new Error("down"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Reforma")).toBeTruthy();
  });

  it("has no move buttons for a single Goal", async () => {
    serve({ ...SAVINGS, goals: [REFORMA] });
    open();
    await screen.findByText("Reforma");
    expect(screen.queryByRole("button", { name: /Move .* up/ })).toBeNull();
  });
});

describe("reordering by keyboard", () => {
  it("sends the new order at once, moves the Goal and keeps focus on its button", async () => {
    serve();
    let answer!: (r: api.OrderResult) => void;
    vi.mocked(api.putGoalOrder).mockReturnValue(new Promise((r) => (answer = r)));
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    const down = within(list).getByRole("button", { name: "Move Reforma down" });
    down.focus();
    await userEvent.keyboard("{Enter}");
    expect(api.putGoalOrder).toHaveBeenCalledWith(["g2", "g1", "g3"]);
    await waitFor(() => expect(order(list)).toEqual(["Viagem", "Reforma", "Carro"]));
    expect(document.activeElement).toBe(within(list).getByRole("button", { name: "Move Reforma down" }));
    expect(screen.getByText("Reforma: position 2 of 3")).toBeTruthy();
    await act(async () => answer(ok));
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("puts focus on the twin button when the Goal reaches an end", async () => {
    serve();
    // The API keeps the order it is given, so the read after the write shows it.
    vi.mocked(api.putGoalOrder).mockImplementation(async (ids) => {
      serve({ ...SAVINGS, goals: ids.map((id) => SAVINGS.goals.find((g) => g.id === id)!) });
      return ok;
    });
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    await userEvent.click(within(list).getByRole("button", { name: "Move Carro up" }));
    await waitFor(() => expect(order(list)).toEqual(["Reforma", "Carro", "Viagem"]));
    await userEvent.click(within(list).getByRole("button", { name: "Move Carro up" }));
    await waitFor(() => expect(order(list)).toEqual(["Carro", "Reforma", "Viagem"]));
    expect(document.activeElement).toBe(within(list).getByRole("button", { name: "Move Carro down" }));
  });

  it("disables Up on the first Goal and Down on the last", async () => {
    serve();
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    expect((within(list).getByRole("button", { name: "Move Reforma up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(list).getByRole("button", { name: "Move Carro down" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("restores the order, says so and keeps focus when the API refuses", async () => {
    serve();
    vi.mocked(api.putGoalOrder).mockResolvedValue({ kind: "error" });
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    await userEvent.click(within(list).getByRole("button", { name: "Move Reforma down" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save the new order");
    expect(order(list)).toEqual(["Reforma", "Viagem", "Carro"]);
    await waitFor(() => expect(document.activeElement).toBe(within(list).getByRole("button", { name: "Move Reforma down" })));
  });

  it("reads the list again when it changed under the User (400)", async () => {
    serve();
    vi.mocked(api.putGoalOrder).mockResolvedValue({ kind: "changed" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Move Reforma down" }));
    expect((await screen.findByRole("alert")).textContent).toContain("changed in the meantime");
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("ignores a press while the previous move is being written", async () => {
    serve();
    vi.mocked(api.putGoalOrder).mockReturnValue(new Promise(() => {}));
    open();
    const list = await screen.findByRole("list", { name: "Goals" });
    await userEvent.click(within(list).getByRole("button", { name: "Move Reforma down" }));
    await userEvent.click(within(list).getByRole("button", { name: "Move Reforma down" }));
    expect(api.putGoalOrder).toHaveBeenCalledTimes(1);
  });
});

describe("Goals", () => {
  const sheet = async () => within(await screen.findByRole("dialog"));

  it("adds one and reads the savings and commitments again", async () => {
    serve();
    vi.mocked(api.saveGoal).mockResolvedValue(ok);
    const { client } = open();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: "Add goal" }));
    const form = await sheet();
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), " Cozinha ");
    await userEvent.type(form.getByRole("textbox", { name: "How much it costs" }), "1500");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.saveGoal).toHaveBeenCalledWith(null, { name: "Cozinha", targetCents: 150000, targetMonth: null });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance", "savings"] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance", "commitments"] });
  });

  it("shows what is wrong beside the fields and sends nothing", async () => {
    serve();
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add goal" }));
    await userEvent.click((await sheet()).getByRole("button", { name: "Save" }));
    expect(api.saveGoal).not.toHaveBeenCalled();
    expect((await sheet()).getByText("Enter a name.")).toBeTruthy();
    expect((await sheet()).getByText("Enter an amount above zero.")).toBeTruthy();
  });

  it("edits one with its values and sends the changed Goal", async () => {
    serve();
    vi.mocked(api.saveGoal).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Viagem" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const form = await sheet();
    expect((form.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Viagem");
    await userEvent.clear(form.getByRole("textbox", { name: "Name" }));
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Europa");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.saveGoal).toHaveBeenCalledWith("g2", { name: "Europa", targetCents: 800000, targetMonth: "2027-07" });
  });

  it("shows the API's field codes and keeps the form open", async () => {
    serve();
    vi.mocked(api.saveGoal).mockResolvedValue({ kind: "fields", fields: { name: "invalid" } });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add goal" }));
    const form = await sheet();
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Casa");
    await userEvent.type(form.getByRole("textbox", { name: "How much it costs" }), "10");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(await form.findByText("That name will not do. Try another.")).toBeTruthy();
  });

  it("says a failed save and stays open", async () => {
    serve();
    vi.mocked(api.saveGoal).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add goal" }));
    const form = await sheet();
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), "Casa");
    await userEvent.type(form.getByRole("textbox", { name: "How much it costs" }), "10");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(await form.findByText("We could not save. Nothing changed.")).toBeTruthy();
  });

  it("asks before deleting, then deletes", async () => {
    serve();
    vi.mocked(api.deleteGoal).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Carro" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(api.deleteGoal).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(api.deleteGoal).toHaveBeenCalledWith("g3");
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("says so when the delete is refused", async () => {
    serve();
    vi.mocked(api.deleteGoal).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Carro" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
  });
});

describe("the Emergency reserve target", () => {
  it("sets the target", async () => {
    serve({ ...SAVINGS, reserveTargetCents: null, reserve: { targetCents: null, savedCents: 0, monthCents: null, expectedMonth: null } });
    vi.mocked(api.putReserve).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Set a target" }));
    const form = within(await screen.findByRole("dialog"));
    expect(form.queryByRole("button", { name: "Clear" })).toBeNull();
    await userEvent.type(form.getByRole("textbox", { name: "How much you want to keep" }), "9000");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.putReserve).toHaveBeenCalledWith(900000);
  });

  it("clears the target with null", async () => {
    serve();
    vi.mocked(api.putReserve).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Change target" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear" }));
    expect(api.putReserve).toHaveBeenCalledWith(null);
  });
});

describe("the Monthly contribution", () => {
  const form = async () => within(await screen.findByRole("dialog"));

  it("shows the split as it is typed and saves the base and the share", async () => {
    serve({ ...SAVINGS, contributionBaseCents: null, reserveSharePercent: null });
    vi.mocked(api.putContribution).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Set contribution" }));
    await userEvent.type((await form()).getByRole("textbox", { name: "How much to save each month" }), "1000");
    await userEvent.type((await form()).getByRole("textbox", { name: /Share for the reserve/ }), "30");
    expect((await form()).getByText(/R\$300\.00 to the reserve and R\$700\.00 to your goals\./)).toBeTruthy();
    await userEvent.click((await form()).getByRole("button", { name: "Save" }));
    expect(api.putContribution).toHaveBeenCalledWith({ baseCents: 100000, reserveSharePercent: 30 });
  });

  it("clearing it sends both nulls", async () => {
    serve();
    vi.mocked(api.putContribution).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Change contribution" }));
    await userEvent.click((await form()).getByRole("button", { name: "Clear" }));
    expect(api.putContribution).toHaveBeenCalledWith(null);
  });

  it("refuses a share over 100 beside its field", async () => {
    serve();
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Change contribution" }));
    const share = (await form()).getByRole("textbox", { name: /Share for the reserve/ });
    await userEvent.clear(share);
    await userEvent.type(share, "101");
    await userEvent.click((await form()).getByRole("button", { name: "Save" }));
    expect(api.putContribution).not.toHaveBeenCalled();
    expect((await form()).getByText("Use a whole number from 0 to 100.")).toBeTruthy();
  });

  it("reads the savings and commitments again after it is saved", async () => {
    serve();
    vi.mocked(api.putContribution).mockResolvedValue(ok);
    const { client } = open();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: "Change contribution" }));
    await userEvent.click((await form()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance", "commitments"] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: savingsKey });
  });
});

describe("Investments", () => {
  const row = async (name: string) => (await screen.findByText(name)).closest("li")!;
  const sheet = async () => within(await screen.findByRole("dialog"));

  it("says a bank Investment with nothing picked is waiting, and that it counts toward neither", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open();
    const r = within(await row("CDB Banco"));
    expect(r.getByText("From the bank")).toBeTruthy();
    expect(r.getByText("Choose what it is for")).toBeTruthy();
    expect(r.getByText(/counts toward neither the reserve nor your goals/)).toBeTruthy();
    expect(r.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  it("says it in Portuguese with the approved wording", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open({ locale: "pt-BR" });
    expect(within(await row("CDB Banco")).getByText("Escolha para quê serve")).toBeTruthy();
  });

  it("sends the pick, then reads the savings again so the reserve and Goals follow the API", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.putInvestmentServes).mockResolvedValue({ kind: "ok" });
    open();
    const r = within(await row("CDB Banco"));
    await userEvent.click(r.getByRole("radio", { name: "Goals" }));
    expect(api.putInvestmentServes).toHaveBeenCalledWith("i2", "goals");
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("shows the reserve the API answers after a pick, without working it out itself", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.putInvestmentServes).mockImplementation(async () => {
      serve({ ...SAVINGS, reserve: { ...SAVINGS.reserve, savedCents: 380000 }, investments: [HAND, { ...BANK_NEW, serves: "reserve" }] });
      return ok;
    });
    open();
    await userEvent.click(within(await row("CDB Banco")).getByRole("radio", { name: "Reserve" }));
    await waitFor(() => expect(screen.getByRole("progressbar", { name: "Emergency reserve progress" }).getAttribute("aria-valuenow")).toBe("380000"));
    expect(within(await row("CDB Banco")).queryByText("Choose what it is for")).toBeNull();
  });

  it("lets the User change a pick later", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.putInvestmentServes).mockResolvedValue(ok);
    open();
    const r = within(await row("Fundo"));
    expect(r.getByRole("radio", { name: "Goals" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(r.getByRole("radio", { name: "Reserve" }));
    expect(api.putInvestmentServes).toHaveBeenCalledWith("i3", "reserve");
  });

  it("says a failed pick and changes nothing", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.putInvestmentServes).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(within(await row("CDB Banco")).getByRole("radio", { name: "Goals" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    expect(api.getSavings).toHaveBeenCalledTimes(1);
  });

  it("marks an edited bank value with the bank's value and takes the bank's back", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.restoreBankValue).mockImplementation(async () => {
      serve({ ...SAVINGS, investments: [HAND, BANK_NEW, { ...BANK_EDITED, valueCents: 100000, edited: false }, BANK_GONE] });
      return ok;
    });
    open();
    const r = within(await row("Fundo"));
    expect(r.getByText("edited")).toBeTruthy();
    expect(r.getByText("bank: R$1,000.00")).toBeTruthy();
    await userEvent.click(r.getByRole("button", { name: "Use the bank's value for Fundo" }));
    expect(api.restoreBankValue).toHaveBeenCalledWith("i3");
    await waitFor(() => expect(within(screen.getByText("Fundo").closest("li")!).queryByText("edited")).toBeNull());
    expect(within(screen.getByText("Fundo").closest("li")!).queryByText(/bank: /)).toBeNull();
  });

  it("shows no edited label on a bank value the User did not change", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open();
    const r = within(await row("LCI Antiga"));
    expect(r.queryByText("edited")).toBeNull();
    expect(r.queryByRole("button", { name: /Use the bank/ })).toBeNull();
  });

  it("keeps a row the bank no longer reports, with a calm note", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open();
    expect(within(await row("LCI Antiga")).getByText("The bank no longer reports this.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gives a hand-typed row edit and delete, and a bank row edit without delete", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open();
    await userEvent.click(within(await row("Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(await row("Fundo")).getByRole("button", { name: "More actions for Fundo" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("adds a hand-typed Investment, serving the reserve unless told otherwise", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add investment" }));
    const form = await sheet();
    await userEvent.type(form.getByRole("textbox", { name: "Name" }), " Poupança ");
    await userEvent.type(form.getByRole("textbox", { name: "Value" }), "0");
    await userEvent.click(form.getByRole("radio", { name: "Goals" }));
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.saveInvestment).toHaveBeenCalledWith(null, { name: "Poupança", valueCents: 0, serves: "goals" });
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("shows what is wrong beside the fields and sends nothing", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add investment" }));
    await userEvent.click((await sheet()).getByRole("button", { name: "Save" }));
    expect(api.saveInvestment).not.toHaveBeenCalled();
    expect((await sheet()).getByText("Enter a name.")).toBeTruthy();
    expect((await sheet()).getByText("Enter a value; zero is fine.")).toBeTruthy();
  });

  it("edits a hand-typed Investment", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const form = await sheet();
    expect((form.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Tesouro Selic");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.saveInvestment).toHaveBeenCalledWith("i1", { name: "Tesouro Selic", valueCents: 250000, serves: "reserve" });
  });

  it("corrects only the value of a bank Investment, keeping its name and pick", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row("LCI Antiga")).getByRole("button", { name: "More actions for LCI Antiga" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const form = await sheet();
    expect(form.queryByRole("textbox", { name: "Name" })).toBeNull();
    const value = form.getByRole("textbox", { name: "Value" });
    await userEvent.clear(value);
    await userEvent.type(value, "70");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect(api.saveInvestment).toHaveBeenCalledWith("i4", { name: "LCI Antiga", valueCents: 7000, serves: "reserve" });
  });

  it("saves a bank Investment whose name is over 60 characters, cut to the backend's cap", async () => {
    const long = "CDB BANCO XYZ S.A. PRE 12,50% A.A. VENC 15/03/2028 LIQUIDEZ DIARIA";
    serve({ ...SAVINGS, investments: [{ ...BANK_GONE, name: long }] });
    vi.mocked(api.saveInvestment).mockResolvedValue(ok);
    open();
    await userEvent.click(within(await row(long)).getByRole("button", { name: `More actions for ${long}` }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await userEvent.click((await sheet()).getByRole("button", { name: "Save" }));
    expect(api.saveInvestment).toHaveBeenCalledWith("i4", { name: long.slice(0, 60).trim(), valueCents: 5000, serves: "reserve" });
  });

  it("asks before deleting a hand-typed Investment, then deletes", async () => {
    serve({ ...SAVINGS, ...WITH_INVESTMENTS });
    vi.mocked(api.deleteInvestment).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(within(await row("Tesouro Selic")).getByRole("button", { name: "More actions for Tesouro Selic" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(api.deleteInvestment).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(api.deleteInvestment).toHaveBeenCalledWith("i1");
    await waitFor(() => expect(api.getSavings).toHaveBeenCalledTimes(2));
  });

  it("invites the first Investment calmly", async () => {
    serve();
    open();
    expect(await screen.findByText("No investments yet.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("accessibility", () => {
  const COMBOS = [["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const;
  const violations = async () =>
    (await axe.run(document.body, AXE)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  describe.each(COMBOS)("%s %s", (theme, locale) => {
    const en = locale === "en";
    it("screen", async () => {
      serve({ ...SAVINGS, goals: [...SAVINGS.goals, LONG] });
      open({ theme, locale });
      await screen.findByText("Carro");
      expect(await violations()).toEqual([]);
    });
    it("screen with Investments from both origins", async () => {
      serve({ ...SAVINGS, ...WITH_INVESTMENTS });
      open({ theme, locale });
      await screen.findByText("CDB Banco");
      expect(await violations()).toEqual([]);
    });
    it("bank Investment form", async () => {
      serve({ ...SAVINGS, ...WITH_INVESTMENTS });
      open({ theme, locale });
      await userEvent.click(await screen.findByRole("button", { name: en ? "More actions for Fundo" : "Mais ações de Fundo" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: en ? "Edit" : "Editar" }));
      await screen.findByRole("dialog");
      expect(await violations()).toEqual([]);
    });
    it("empty screen", async () => {
      serve({ ...SAVINGS, reserveTargetCents: null, contributionBaseCents: null, reserveSharePercent: null, reserve: { targetCents: null, savedCents: 0, monthCents: null, expectedMonth: null }, goals: [] });
      open({ theme, locale });
      await screen.findByRole("button", { name: en ? "Set contribution" : "Definir aporte" });
      expect(await violations()).toEqual([]);
    });
    it("goal form with errors", async () => {
      serve();
      open({ theme, locale });
      await userEvent.click(await screen.findByRole("button", { name: en ? "Add goal" : "Adicionar objetivo" }));
      await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: en ? "Save" : "Salvar" }));
      expect(await violations()).toEqual([]);
    });
    it("contribution form", async () => {
      serve();
      open({ theme, locale });
      await userEvent.click(await screen.findByRole("button", { name: en ? "Change contribution" : "Alterar aporte" }));
      await screen.findByRole("dialog");
      expect(await violations()).toEqual([]);
    });
    it("delete dialog", async () => {
      serve();
      open({ theme, locale });
      await userEvent.click(await screen.findByRole("button", { name: en ? "More actions for Carro" : "Mais ações de Carro" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: en ? "Delete" : "Excluir" }));
      await screen.findByRole("alertdialog");
      expect(await violations()).toEqual([]);
    });
  });
});
