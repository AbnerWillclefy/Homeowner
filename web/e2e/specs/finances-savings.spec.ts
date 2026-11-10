import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import type { FakeState } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English: Economias is a route of its own (/finances/economias) with a back
// link, reached from Resumo. With nothing set every card says what to do first. Each form is a dialog: a refused value
// shows its message on the field and a failed write keeps what was typed and succeeds on the next try. An Investment
// and a Goal can be added, changed and deleted; the Emergency reserve target and the Monthly contribution can be set
// and cleared, the contribution showing the split in money as it is typed. Goals are reordered in a mode with Up and
// Down buttons, by keyboard, focus stays on the button and the order is still there after a reload. At 320px with the
// root font at 200% nothing overflows sideways, with the long names and a dialog open.

const LOCALES = [
  {
    locale: "pt-BR",
    back: "Finanças",
    open: "Ver economias",
    title: "Economias",
    cards: { contribution: "Aporte mensal", reserve: "Reserva de emergência", goals: "Objetivos", investments: "Investimentos" },
    emptyContribution: "Defina quanto guardar por mês para ver para onde vai.",
    emptyReserve: "Ainda sem meta. Sem ela, todo o aporte vai para os objetivos.",
    emptyGoals: "Nenhum objetivo ainda. Crie o primeiro, como a reforma da cozinha.",
    emptyInvestments: "Nenhum investimento ainda. Adicione o que já guardou para ver o progresso.",
    transfer: /Mandou dinheiro para um investimento em um banco não conectado\?/,
    transferForm: /Dinheiro mandado para um investimento em um banco não conectado entra como gasto/,
    setContribution: "Definir aporte",
    setReserve: "Definir meta",
    changeReserve: "Alterar meta",
    change: "Alterar",
    addGoal: "Adicionar objetivo",
    addInvestment: "Adicionar investimento",
    newInvestment: "Novo investimento",
    editInvestment: "Editar investimento",
    newGoal: "Novo objetivo",
    editGoal: "Editar objetivo",
    contributionBase: "Quanto guardar por mês",
    contributionShare: "Parte para a reserva (%)",
    reserveField: "Quanto você quer guardar",
    name: "Nome",
    value: "Valor atual",
    goalTarget: "Quanto custa",
    goalMonth: "Mês (opcional)",
    noDate: "Sem data",
    reserveGroup: "Reserva",
    save: "Salvar",
    clear: "Limpar",
    cancel: "Cancelar",
    deleteGoal: "Excluir objetivo",
    deleteInvestment: "Excluir investimento",
    reorder: "Reordenar",
    done: "Concluir",
    up: /^Subir /,
    down: /^Descer /,
    nameRequired: "Digite um nome.",
    moneyInvalid: "Digite um valor, por exemplo 1.500,00.",
    shareInvalid: "Use um número inteiro de 0 a 100.",
    saveFailed: "Não conseguimos salvar. Tente de novo.",
    preview: (reserve: string, goals: string) => `${reserve} para a reserva e ${goals} para os objetivos.`,
    percent: "41% da meta",
    by: "até maio de 2027",
    typedMoney: "1.500,00",
    typedBig: "30.000,00",
    reorderFailed: "Não conseguimos salvar a nova ordem. Tente de novo.",
  },
  {
    locale: "en-US",
    back: "Finances",
    open: "See savings",
    title: "Savings",
    cards: { contribution: "Monthly contribution", reserve: "Emergency reserve", goals: "Goals", investments: "Investments" },
    emptyContribution: "Set how much to save each month to see where it goes.",
    emptyReserve: "No target yet. Without one, the whole contribution goes to your Goals.",
    emptyGoals: "No Goals yet. Add the first one, such as a kitchen renovation.",
    emptyInvestments: "No Investments yet. Add what you have already saved to see your progress.",
    transfer: /Sent money to an investment at a bank that is not connected\?/,
    transferForm: /Money sent to an investment at a bank that is not connected arrives as an expense/,
    setContribution: "Set contribution",
    setReserve: "Set a target",
    changeReserve: "Change target",
    change: "Change",
    addGoal: "Add a Goal",
    addInvestment: "Add an Investment",
    newInvestment: "New Investment",
    editInvestment: "Edit Investment",
    newGoal: "New Goal",
    editGoal: "Edit Goal",
    contributionBase: "How much to save each month",
    contributionShare: "Share for the reserve (%)",
    reserveField: "How much you want to keep",
    name: "Name",
    value: "Current value",
    goalTarget: "How much it costs",
    goalMonth: "Month (optional)",
    noDate: "No date",
    reserveGroup: "Reserve",
    save: "Save",
    clear: "Clear",
    cancel: "Cancel",
    deleteGoal: "Delete Goal",
    deleteInvestment: "Delete Investment",
    reorder: "Reorder",
    done: "Done",
    up: /^Up /,
    down: /^Down /,
    nameRequired: "Enter a name.",
    moneyInvalid: "Enter an amount, for example 1,500.00.",
    shareInvalid: "Use a whole number from 0 to 100.",
    saveFailed: "We could not save. Try again.",
    preview: (reserve: string, goals: string) => `${reserve} to the reserve and ${goals} to your Goals.`,
    percent: "41% of the target",
    by: "by May 2027",
    typedMoney: "1,500.00",
    typedBig: "30,000.00",
    reorderFailed: "We could not save the new order. Try again.",
  },
] as const;

type Savings = NonNullable<NonNullable<FakeState["finance"]>["savings"]>;

const LONG = "Reforma da cozinha e da área de serviço";

const stateWith = (savings?: Savings): FakeState => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
    ...(savings ? { savings } : {}),
  };
  return s;
};

const FILLED: Savings = {
  reserveTargetCents: 10000000,
  contributionBaseCents: 100000,
  reserveSharePercent: 40,
  investments: [
    { id: "investment-1", name: "Tesouro Selic", valueCents: 4100000, serves: "reserve" },
    { id: "investment-2", name: "CDB do banco que não está conectado ao aplicativo", valueCents: 1250000, serves: "goals" },
  ],
  goals: [
    { id: "goal-1", name: LONG, targetCents: 5000000, targetMonth: "2027-05" },
    { id: "goal-2", name: "Viagem", targetCents: 1200000, targetMonth: null },
    { id: "goal-3", name: "Notebook", targetCents: 800000, targetMonth: null },
  ],
};

const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    const open = async (page: Page, baseURL: string | undefined, fakeApi: { use(h: typeof signedInHandlers): void }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances/economias", baseURL!).toString());
    };

    test.describe("with nothing set", () => {
      test.use({ fakeState: stateWith() });

      test("every card says what to do first, and the screen is reached from Resumo and goes back to it", async ({ page, baseURL, fakeApi }) => {
        fakeApi.use(signedInHandlers);
        await seedSession(page, { email: RESIDENT_EMAIL });
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("link", { name: l.open, exact: true }).click();
        await expect(page).toHaveURL(/\/finances\/economias$/);
        await expect(page.getByRole("heading", { name: l.title, level: 2 })).toBeVisible();
        await expect(card(page, l.cards.contribution)).toContainText(l.emptyContribution);
        await expect(card(page, l.cards.reserve)).toContainText(l.emptyReserve);
        await expect(card(page, l.cards.goals)).toContainText(l.emptyGoals);
        await expect(card(page, l.cards.investments)).toContainText(l.emptyInvestments);
        // The hint about retyping money sent to an unconnected investment sits in the Investments card.
        await expect(card(page, l.cards.investments)).toContainText(l.transfer);
        await page.getByRole("button", { name: l.back, exact: true }).click();
        await expect(page).toHaveURL(/\/finances$/);
      });

      test("sets and clears the Monthly contribution, showing the split in money as it is typed", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        await card(page, l.cards.contribution).getByRole("button", { name: l.setContribution }).click();
        const d = dialog(page);
        await expect(d.getByRole("button", { name: l.clear })).toHaveCount(0);
        await d.getByLabel(l.contributionBase).fill(l.typedBig);
        await d.getByLabel(l.contributionShare).fill("30");
        const money = (cents: number) => new Intl.NumberFormat(l.locale, { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\s/g, " ");
        await expect(d.getByText(/./).filter({ hasText: l.preview(money(900000), money(2100000)).replace(/\s/g, " ") }).first()).toBeVisible();
        // A share past 100 is refused on its field and nothing is sent.
        await d.getByLabel(l.contributionShare).fill("101");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toContainText(l.shareInvalid);
        expect(fakeApi.requests.filter((r) => r.path === "/me/finance/contribution")).toEqual([]);
        await d.getByLabel(l.contributionShare).fill("30");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toHaveCount(0);
        await expect(card(page, l.cards.contribution)).toContainText(money(3000000));
        await expect(card(page, l.cards.contribution)).toContainText(money(900000));
        await card(page, l.cards.contribution).getByRole("button", { name: l.change }).click();
        await dialog(page).getByRole("button", { name: l.clear }).click();
        await expect(dialog(page)).toHaveCount(0);
        await expect(card(page, l.cards.contribution)).toContainText(l.emptyContribution);
      });

      test("sets and clears the Emergency reserve target", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        await card(page, l.cards.reserve).getByRole("button", { name: l.setReserve }).click();
        const d = dialog(page);
        await d.getByLabel(l.reserveField).fill("abc");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toContainText(l.moneyInvalid);
        await d.getByLabel(l.reserveField).fill(l.typedBig);
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toHaveCount(0);
        await expect(card(page, l.cards.reserve)).not.toContainText(l.emptyReserve);
        await card(page, l.cards.reserve).getByRole("button", { name: l.changeReserve }).click();
        await dialog(page).getByRole("button", { name: l.clear }).click();
        await expect(card(page, l.cards.reserve)).toContainText(l.emptyReserve);
      });

      test("adds an Investment; a refused value shows on its field and a failed write keeps what was typed", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        await card(page, l.cards.investments).getByRole("button", { name: l.addInvestment }).click();
        const d = dialog(page);
        await expect(d.getByRole("heading", { name: l.newInvestment })).toBeVisible();
        await expect(d).toContainText(l.transferForm);
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toContainText(l.nameRequired);
        await expect(d).toContainText(l.moneyInvalid);
        await d.getByLabel(l.name).fill("Tesouro Selic");
        await d.getByLabel(l.value).fill(l.typedMoney);
        fakeApi.override("POST /me/finance/investments", { status: 500, body: { error: "boom" } }, { once: true });
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toContainText(l.saveFailed);
        await expect(d.getByLabel(l.name)).toHaveValue("Tesouro Selic");
        await expect(d.getByLabel(l.value)).toHaveValue(l.typedMoney);
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toHaveCount(0);
        const investments = card(page, l.cards.investments);
        await expect(investments.getByRole("button", { name: /Tesouro Selic/ })).toBeVisible();
        await expect(investments.getByRole("heading", { name: new RegExp(`^${l.reserveGroup}`) })).toBeVisible();
        await expect(investments).not.toContainText(l.emptyInvestments);
      });

      test("adds a Goal with a month, and one without", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const goals = card(page, l.cards.goals);
        await goals.getByRole("button", { name: l.addGoal }).click();
        const d = dialog(page);
        await expect(d.getByRole("heading", { name: l.newGoal })).toBeVisible();
        await d.getByLabel(l.name).fill("Viagem");
        await d.getByLabel(l.goalTarget).fill("0");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toContainText(l.moneyInvalid);
        await d.getByLabel(l.goalTarget).fill(l.typedMoney);
        await d.getByLabel(l.goalMonth).fill("2027-05");
        await d.getByRole("button", { name: l.noDate }).click();
        await expect(d.getByLabel(l.goalMonth)).toHaveValue("");
        await d.getByLabel(l.goalMonth).fill("2027-05");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toHaveCount(0);
        await expect(goals).toContainText("Viagem");
        await expect(goals).toContainText(l.by);
        await goals.getByRole("button", { name: l.addGoal }).click();
        await dialog(page).getByLabel(l.name).fill("Notebook");
        await dialog(page).getByLabel(l.goalTarget).fill(l.typedMoney);
        await dialog(page).getByRole("button", { name: l.save }).click();
        await expect(goals.getByRole("button", { name: /Notebook/ })).toBeVisible();
      });
    });

    test.describe("with savings", () => {
      test.use({ fakeState: stateWith(FILLED) });

      test("changes and deletes an Investment, and a Goal", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const investments = card(page, l.cards.investments);
        await expect(card(page, l.cards.reserve)).toContainText(l.percent);
        await investments.getByRole("button", { name: /Tesouro Selic/ }).click();
        let d = dialog(page);
        await expect(d.getByRole("heading", { name: l.editInvestment })).toBeVisible();
        await d.getByLabel(l.value).fill("0");
        await d.getByRole("button", { name: l.save }).click();
        await expect(d).toHaveCount(0);
        await expect(card(page, l.cards.reserve)).toContainText("0%");
        await investments.getByRole("button", { name: /Tesouro Selic/ }).click();
        await dialog(page).getByRole("button", { name: l.deleteInvestment }).click();
        await page.getByRole("dialog").last().getByRole("button", { name: l.deleteInvestment }).click();
        await expect(dialog(page)).toHaveCount(0);
        await expect(investments.getByRole("button", { name: /Tesouro Selic/ })).toHaveCount(0);

        const goals = card(page, l.cards.goals);
        await goals.getByRole("button", { name: new RegExp(LONG) }).click();
        d = dialog(page);
        await expect(d.getByRole("heading", { name: l.editGoal })).toBeVisible();
        await expect(d.getByLabel(l.name)).toHaveValue(LONG);
        await d.getByLabel(l.name).fill("Cozinha");
        await d.getByRole("button", { name: l.save }).click();
        await expect(goals.getByRole("button", { name: /Cozinha/ })).toBeVisible();
        await goals.getByRole("button", { name: /Cozinha/ }).click();
        await dialog(page).getByRole("button", { name: l.deleteGoal }).click();
        await page.getByRole("dialog").last().getByRole("button", { name: l.deleteGoal }).click();
        await expect(goals.getByRole("button", { name: /Cozinha/ })).toHaveCount(0);
      });

      test("reorders Goals with the keyboard, focus stays on the button, and the order survives a reload", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const goals = card(page, l.cards.goals);
        await goals.getByRole("button", { name: l.reorder }).click();
        await expect(goals.getByRole("button", { name: l.addGoal })).toHaveCount(0);
        await expect(goals.getByRole("button", { name: l.up }).first()).toBeDisabled();
        await expect(goals.getByRole("button", { name: l.down }).last()).toBeDisabled();
        const names = () => goals.getByRole("listitem").evaluateAll((items) => items.map((i) => i.textContent ?? ""));
        const moveUp = goals.getByRole("button", { name: /Notebook/ }).and(goals.getByRole("button", { name: l.up }));
        await moveUp.focus();
        await page.keyboard.press("Enter");
        await expect(moveUp).toBeFocused();
        expect((await names())[1]).toContain("Notebook");
        await page.keyboard.press("Enter");
        expect((await names())[0]).toContain("Notebook");
        // At the top its Up is disabled, so focus moves to its Down twin.
        await expect(goals.getByRole("button", { name: /Notebook/ }).and(goals.getByRole("button", { name: l.down }))).toBeFocused();
        await goals.getByRole("button", { name: l.done }).click();
        await expect(goals.getByRole("button", { name: l.addGoal })).toBeVisible();
        await page.reload();
        await expect(goals.getByRole("listitem").first()).toContainText("Notebook");
      });

      test("a reorder that fails puts the order back and says so", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const goals = card(page, l.cards.goals);
        await goals.getByRole("button", { name: l.reorder }).click();
        fakeApi.override("PUT /me/finance/goals/order", { status: 500, body: { error: "boom" } }, { once: true });
        await goals.getByRole("button", { name: /Viagem/ }).and(goals.getByRole("button", { name: l.up })).click();
        await expect(goals.getByRole("alert")).toHaveText(l.reorderFailed);
        await expect(goals.getByRole("listitem").nth(1)).toContainText("Viagem");
      });
    });

    test.describe("at 320px and the largest text", () => {
      test.use({ fakeState: stateWith(FILLED), viewport: { width: 320, height: 640 } });

      test("nothing overflows sideways, with long names, reorder mode and a form open", async ({ page, baseURL, fakeApi }) => {
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await open(page, baseURL, fakeApi);
        const goals = card(page, l.cards.goals);
        await expect(goals).toContainText(LONG);
        expect(await noSideScroll(page)).toBe(true);
        await goals.getByRole("button", { name: l.reorder }).click();
        expect(await noSideScroll(page)).toBe(true);
        await goals.getByRole("button", { name: l.done }).click();
        await goals.getByRole("button", { name: new RegExp(LONG) }).click();
        const d = dialog(page);
        await expect(d.getByRole("button", { name: l.deleteGoal })).toBeVisible();
        expect(await noSideScroll(page)).toBe(true);
        expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await d.getByRole("button", { name: l.cancel }).click();
        await card(page, l.cards.investments).getByRole("button", { name: /CDB do banco/ }).click();
        expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await noSideScroll(page)).toBe(true);
      });
    });
  });
}
