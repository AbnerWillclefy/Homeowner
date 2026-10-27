import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { uncheckedDay } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the Check-in dialog opening by itself on Today when the day has no Check-in. It opens on a cold
// start; "Agora não" / "Not now" and Escape close it, the pill keeps the muted "?", and it stays closed on
// the same day (switching tabs, resuming) until the next launch; a new Home day opens it again; a saved Check-in
// or any tab but Today never opens it; it waits behind the Invite, the rating step and the start choice. Each
// test runs in pt-BR first, then en-US.

const LOCALES = [
  {
    locale: "pt-BR",
    wordmark: "Check-in",
    unset: "Fazer check-in",
    notNow: "Agora não",
    save: "Salvar",
    chores: "Afazeres",
    today: "Hoje",
    join: "Sair do meu lar e entrar neste",
    inviteHeading: "Entrar significa sair do seu lar",
    ratingHeading: "Avalie os afazeres mais pesados",
    ratingDone: "Concluir",
    startHeading: "Quando você quer as suas tarefas?",
    startTomorrow: "Começar amanhã",
  },
  {
    locale: "en-US",
    wordmark: "Check-in",
    unset: "Check in",
    notNow: "Not now",
    save: "Save",
    chores: "Chores",
    today: "Today",
    join: "Leave my Home and join this one",
    inviteHeading: "Joining means leaving your Home",
    ratingHeading: "Rate the biggest Chores",
    ratingDone: "Done",
    startHeading: "When do you want your Tasks?",
    startTomorrow: "Start tomorrow",
  },
] as const;

const CHECK_IN_READ = /\/home\/check-in$/;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: { ...signedInResident(), checkIn: uncheckedDay() } });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const dialog = (page: Page) => page.getByRole("dialog", { name: l.wordmark });
    const pill = (page: Page) => shell.topBar(page).getByRole("button", { name: l.unset, exact: true });
    const tab = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
    /** A resume of the app, sent until the Check-in read it triggers has gone out and answered. */
    async function resume(page: Page) {
      await expect(async () => {
        const read = page.waitForResponse(CHECK_IN_READ, { timeout: 500 });
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
        await read;
      }).toPass();
    }

    test("a cold start on Today opens the dialog by itself, with focus on its title", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("heading", { name: l.wordmark })).toBeFocused();
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("Not now closes it, the pill stays muted, and switching tabs does not bring it back", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await dialog(page).getByRole("button", { name: l.notNow, exact: true }).click();
      await expect(dialog(page)).toBeHidden();
      await expect(pill(page)).toBeFocused();
      await expect(pill(page)).toHaveText("?", { useInnerText: true });

      await tab(page, l.chores).click();
      await expect(tab(page, l.chores)).toHaveAttribute("aria-current", "page");
      await tab(page, l.today).click();
      await expect(tab(page, l.today)).toHaveAttribute("aria-current", "page");
      await expect(pill(page)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("Escape is the same as Not now, and focus ends on the pill", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      await expect(pill(page)).toBeFocused();
      await expect(pill(page)).toHaveText("?", { useInnerText: true });
    });

    test("a resume on the same day does not reopen it, and a reload does", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();

      await resume(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.reload();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("heading", { name: l.wordmark })).toBeFocused();
    });

    test("a resume on a new Home day opens it again", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();

      fakeApi.state.checkIn = uncheckedDay("2030-01-16");
      await resume(page);
      await expect(dialog(page)).toBeVisible();
    });

    test("an auto-open after one from the pill returns focus to the pill", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      await pill(page).click();
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();

      fakeApi.state.checkIn = uncheckedDay("2030-01-16");
      await resume(page);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      await expect(pill(page)).toBeFocused();
    });

    test("a Check-in saved for today means no dialog on launch", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "normal", restrictions: [] };
      await launchApp(page, baseURL!);
      await expect(shell.topBar(page).getByRole("button", { name: /^(Energia hoje|Energy today)/ })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    for (const path of ["/chores", "/home", "/me"]) {
      test(`a cold start on ${path} does not open it`, async ({ page, baseURL }) => {
        await visit(page, new URL(path, baseURL!).toString());
        await expect(pill(page)).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });
    }

    test("a refetch that says checked in does not close a form that is open", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();

      // Saved on another device while this one has the form open.
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
      await resume(page);
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("radio")).toHaveCount(4);
      await expect(dialog(page).getByRole("button", { name: l.save, exact: true })).toBeVisible();
    });

    test("a day rolling over under an open form stays open, and Not now closes it for the new day", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(dialog(page)).toBeVisible();

      // Midnight passes while the form is open: the Home now reads the next day, still unchecked.
      fakeApi.state.checkIn = uncheckedDay("2030-01-16");
      await resume(page);
      await expect(dialog(page)).toBeVisible();

      // The Resident has seen the 16th's prompt: Not now closes it and a same-day resume does not reopen it.
      await dialog(page).getByRole("button", { name: l.notNow, exact: true }).click();
      await expect(dialog(page)).toBeHidden();
      await resume(page);
      await expect(dialog(page)).toBeHidden();
      await expect(pill(page)).toBeFocused();
    });

    test("a failed Check-in read opens nothing",async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/check-in", json(500, { error: "boom" }));
      await launchApp(page, baseURL!);
      await expect(shell.topBar(page).getByRole("button", { name: /^(Energia indisponível|Energy unavailable)/ })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("it waits behind the Invite, the rating step and the start choice, then opens", async ({ page, baseURL, fakeApi }) => {
      fakeApi.on("GET /invites/abc123", () => json(200, {}));
      fakeApi.on("GET /home/chores/settings", () => json(200, { residents: [{ you: true, chores: {} }] }));
      fakeApi.on("POST /invites/abc123/accept", (_, state) => json(200, state.home));
      await visit(page, new URL("/#invite=abc123", baseURL!).toString());

      // The Invite first, alone.
      await expect(page.getByRole("dialog", { name: l.inviteHeading })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await page.getByRole("button", { name: l.join, exact: true }).click();

      // Then the rating step, alone.
      await expect(page.getByRole("dialog", { name: l.ratingHeading })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await page.getByRole("button", { name: l.ratingDone, exact: true }).click();

      // Then the start choice, alone.
      await expect(page.getByRole("dialog", { name: l.startHeading })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await page.getByRole("button", { name: l.startTomorrow, exact: true }).click();

      // Only now the Check-in.
      await expect(dialog(page)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });
  });
}
