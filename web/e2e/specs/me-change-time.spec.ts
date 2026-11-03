import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident, thirtyDayHistory } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";

// What this covers, in both locales and at the largest text size: the "Change time" action on Me's Completions and
// on Today's Done cards. A Completion moves from today to yesterday and Today's Done list loses it; the server's
// day wins when the device zone differs from the Home's; every error code shows its calm message and leaves the
// dialog open (and a retry then works); a value outside the bounds is refused without a call; a double click sends
// one PATCH; keyboard only, with focus back on the action; and no action on a housemate's page.
// The app's clock is fixed at 10:30 on 2030-01-15 in the Home's zone (America/Sao_Paulo, which is also the device).

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    home: "Lar",
    change: "Mudar hora",
    label: "Quando você fez?",
    save: "Salvar",
    cancel: "Cancelar",
    today: "Hoje",
    yesterday: "Ontem",
    errors: {
      in_future: "Esse horário ainda não chegou. Escolha um que já passou.",
      too_old: "Só dá para mudar os últimos 30 dias. Escolha um dia mais recente.",
      before_task: "Isso é antes de a tarefa começar. Escolha um horário mais tarde.",
      invalid_completed_at: "Esse horário está incompleto. Escolha a data e a hora.",
      not_yours: "Só quem fez esta tarefa pode mudar a hora dela.",
      notFound: "Esta conclusão não está mais aqui. Abra a tela de novo para ver a lista atual.",
      offline: "Sem conexão agora. Confira e tente de novo.",
      error: "Não foi possível salvar a hora. Tente de novo em instantes.",
    },
  },
  {
    locale: "en-US",
    me: "Me",
    home: "Home",
    change: "Change time",
    label: "When did you do it?",
    save: "Save",
    cancel: "Cancel",
    today: "Today",
    yesterday: "Yesterday",
    errors: {
      in_future: "That time has not come yet. Pick one that has already passed.",
      too_old: "Only the last 30 days can be changed. Pick a more recent day.",
      before_task: "That is before this Task started. Pick a later time.",
      invalid_completed_at: "That time is not complete. Pick the date and the time.",
      not_yours: "Only the people who did this Task can change its time.",
      notFound: "This Completion is no longer here. Open the screen again to see it up to date.",
      offline: "No connection right now. Check it and try again.",
      error: "Could not save the time. Try again in a moment.",
    },
  },
] as const;

const SHOWER = "Deep clean the shower";
const STOVE = "Clean the stove";

/** The caller's history, the shower also in Today's Done list, and the stove only able to move back to 2030-01-14. */
const withToday = () => {
  const state = signedInResident();
  const history = thirtyDayHistory();
  history.find((completion) => completion.id === "h3")!.windowStart = "2030-01-14";
  state.residents![0]!.completions = history;
  state.residents![1]!.completions = [{ id: "b1", choreName: "Water the plants", category: "outdoor", completedAt: "2030-01-15T12:30:00Z" }];
  state.dayPlan!.doneToday = [
    { id: "task-h1", completionId: "h1", choreName: SHOWER, completedAt: "2030-01-15T12:02:00Z", category: "bathroom", with: [] },
  ];
  return state;
};

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
const patches = (requests: { method: string; path: string; body: unknown }[]) => requests.filter((r) => r.method === "PATCH");
// The largest text size: the root font size doubled, so every rem grows with it.
const largestText = (page: Page) => page.addInitScript(() => void document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%")));
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const dayList = (page: Page, heading: string): Locator => page.getByRole("heading", { name: heading, level: 4 }).locator("xpath=following-sibling::ul");

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: withToday() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await largestText(page);
      await page.clock.setFixedTime(new Date("2030-01-15T10:30:00-03:00"));
    });

    async function openMe(page: Page, baseURL: string | undefined) {
      await launchApp(page, baseURL!);
      await nav(page, l.me).click();
    }
    const card = (page: Page, chore: string) => page.getByRole("listitem").filter({ hasText: chore });
    const changeOf = (page: Page, chore: string) => card(page, chore).getByRole("button", { name: l.change });
    const dialogOf = (page: Page) => page.getByRole("dialog", { name: l.change });

    test("moves a Completion from today to yesterday, and Today's Done list loses it", async ({ page, baseURL, fakeApi }) => {
      await openMe(page, baseURL);
      await expect(dayList(page, l.today).getByRole("listitem")).toHaveCount(2);
      await changeOf(page, SHOWER).click();
      const dialog = dialogOf(page);
      await expect(dialog.getByLabel(l.label)).toHaveValue("2030-01-15T09:02");
      expect(await noOverflow(page)).toBe(true);
      await dialog.getByLabel(l.label).fill("2030-01-14T18:00");
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      await expect(dayList(page, l.today).getByRole("listitem")).toHaveCount(1);
      await expect(dayList(page, l.yesterday).getByRole("listitem").filter({ hasText: SHOWER })).toHaveCount(1);
      expect(patches(fakeApi.requests).map((r) => r.body)).toEqual([{ completedAt: "2030-01-14T21:00:00.000Z" }]);

      await nav(page, l.home).click();
      await expect(page.getByText("Vacuum the living room")).toHaveCount(0);
      await expect(page.getByText(SHOWER)).toHaveCount(0);
    });

    test("moves a Completion from Today's Done card, and Me shows it under its new day", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const done = card(page, SHOWER);
      await expect(done).toBeVisible();
      // On the bottom row of the card, below the time line.
      const [timeLine, button] = await Promise.all([done.locator("p").last().boundingBox(), changeOf(page, SHOWER).boundingBox()]);
      expect(button!.y).toBeGreaterThan(timeLine!.y + timeLine!.height - 1);

      await changeOf(page, SHOWER).click();
      await dialogOf(page).getByLabel(l.label).fill("2030-01-14T18:00");
      await dialogOf(page).getByRole("button", { name: l.save }).click();
      await expect(dialogOf(page)).toHaveCount(0);
      await expect(page.getByText(SHOWER)).toHaveCount(0);

      await nav(page, l.me).click();
      await expect(dayList(page, l.yesterday).getByRole("listitem").filter({ hasText: SHOWER })).toHaveCount(1);
    });

    test.describe("with a device in another zone than the Home", () => {
      // Tokyo is 12 hours ahead of Sao Paulo: 10:00 on the 15th there is 22:00 on the 14th in the Home.
      test.use({ timezoneId: "Asia/Tokyo" });

      test("counts the day the server decided", async ({ page, baseURL, fakeApi }) => {
        await openMe(page, baseURL);
        await changeOf(page, SHOWER).click();
        await dialogOf(page).getByLabel(l.label).fill("2030-01-15T10:00");
        await dialogOf(page).getByRole("button", { name: l.save }).click();
        await expect(dialogOf(page)).toHaveCount(0);
        expect(patches(fakeApi.requests).map((r) => r.body)).toEqual([{ completedAt: "2030-01-15T01:00:00.000Z" }]);
        await expect(dayList(page, l.yesterday).getByRole("listitem").filter({ hasText: SHOWER })).toHaveCount(1);
        await expect(dayList(page, l.today).getByRole("listitem").filter({ hasText: SHOWER })).toHaveCount(0);
      });
    });

    test("refuses a time outside the window without calling the API", async ({ page, baseURL, fakeApi }) => {
      await openMe(page, baseURL);
      await changeOf(page, SHOWER).click();
      const dialog = dialogOf(page);
      await dialog.getByLabel(l.label).fill("2030-01-15T10:31");
      await dialog.getByRole("button", { name: l.save }).click();
      await expect(dialog.getByRole("alert")).toHaveText(l.errors.in_future);
      await dialog.getByLabel(l.label).fill("2029-12-16T23:59");
      await dialog.getByRole("button", { name: l.save }).click();
      await expect(dialog.getByRole("alert")).toHaveText(l.errors.too_old);
      expect(patches(fakeApi.requests)).toHaveLength(0);

      // Exactly now and exactly the first minute of the window are allowed.
      await dialog.getByLabel(l.label).fill("2030-01-15T10:30");
      await dialog.getByRole("button", { name: l.save }).click();
      await expect(dialog).toHaveCount(0);
    });

    for (const [name, status, body, message] of [
      ["in_future", 400, { error: "in_future" }, l.errors.in_future],
      ["too_old", 400, { error: "too_old" }, l.errors.too_old],
      ["before_task", 400, { error: "before_task" }, l.errors.before_task],
      ["invalid_completed_at", 400, { error: "invalid_completed_at" }, l.errors.invalid_completed_at],
      ["not_yours", 409, { error: "not_yours" }, l.errors.not_yours],
      ["completion not found", 404, { error: "completion not found" }, l.errors.notFound],
      ["a server failure", 500, { error: "internal error" }, l.errors.error],
    ] as const) {
      test(`shows a calm message for ${name} and keeps the dialog open for another try`, async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("PATCH /home/completions/{id}", json(status, body), { once: true });
        await openMe(page, baseURL);
        await changeOf(page, SHOWER).click();
        const dialog = dialogOf(page);
        await dialog.getByRole("button", { name: l.save }).click();

        const alert = dialog.getByRole("alert");
        await expect(alert).toHaveText(message);
        expect(message).not.toContain("!");
        await expect(alert.locator("p")).not.toHaveClass(/danger/);
        expect(await noOverflow(page)).toBe(true);
        await expect(dialog.getByRole("button", { name: l.save })).toBeEnabled();

        // The same dialog sends again, and this time the fake answers.
        await dialog.getByRole("button", { name: l.save }).click();
        await expect(dialog).toHaveCount(0);
      });
    }

    test("shows a calm message when the network fails, and the dialog stays open", async ({ page, baseURL }) => {
      await page.route(/\/home\/completions\//, (route) => route.abort("failed"));
      await openMe(page, baseURL);
      await changeOf(page, SHOWER).click();
      await dialogOf(page).getByRole("button", { name: l.save }).click();
      await expect(dialogOf(page).getByRole("alert")).toHaveText(l.errors.offline);
    });

    test("the server's before_task rule answers a move to before the Task started", async ({ page, baseURL }) => {
      await openMe(page, baseURL);
      await changeOf(page, STOVE).click();
      await dialogOf(page).getByLabel(l.label).fill("2030-01-13T10:00");
      await dialogOf(page).getByRole("button", { name: l.save }).click();
      await expect(dialogOf(page).getByRole("alert")).toHaveText(l.errors.before_task);
    });

    test("a double click on Save sends one PATCH and the action cannot be repeated while saving", async ({ page, baseURL, fakeApi }) => {
      const held = hold(page, /\/home\/completions\//);
      await openMe(page, baseURL);
      await changeOf(page, SHOWER).click();
      const dialog = dialogOf(page);
      await dialog.getByLabel(l.label).fill("2030-01-14T18:00");
      const save = dialog.getByRole("button", { name: l.save });
      await save.dblclick();
      await expect(save).toBeDisabled();
      await expect(save).toHaveAttribute("aria-busy", "true");
      held.release();
      await expect(dialog).toHaveCount(0);
      expect(patches(fakeApi.requests)).toHaveLength(1);
    });

    test("works with the keyboard alone, and focus returns to the action", async ({ page, baseURL }) => {
      await openMe(page, baseURL);
      const action = changeOf(page, SHOWER);
      await action.focus();
      await page.keyboard.press("Enter");
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      // Focus moved in: the title first, then the picker (labelled), then the buttons.
      await page.keyboard.press("Tab");
      await expect(dialog.getByLabel(l.label)).toBeFocused();
      await dialog.getByLabel(l.label).fill("2030-01-15T09:30");
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(changeOf(page, SHOWER)).toBeFocused();

      // Escape closes without saving and also returns focus.
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(changeOf(page, SHOWER)).toBeFocused();
    });

    test("has no action on a housemate's page", async ({ page }) => {
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByText("Water the plants")).toBeVisible();
      await expect(page.getByRole("button", { name: l.change })).toHaveCount(0);
    });
  });
}
