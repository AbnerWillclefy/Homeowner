import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers: the Home tab leads with the Residents card, in both locales. The order of the sections, the
// caller's "You" row (a name-less User, shown by the email's local part, opening Me), another Resident's link, the
// skeleton while the list is held (and no layout shift when it arrives), the inline error with Retry, and the Home
// settings card closed by default.

const LOCALES = [
  {
    locale: "pt-BR",
    residents: "Moradores",
    invite: "Convidar um morador",
    settings: "Ajustes do lar",
    settingsHint: "Horário do planejamento e fuso horário",
    leave: "Sair deste lar",
    you: "Você",
    streak: "11 dias",
    done: "3 concluídas hoje",
    error: "Algo deu errado ao carregar os moradores. Tente novamente em instantes.",
    retry: "Tentar novamente",
    me: "Eu",
  },
  {
    locale: "en-US",
    residents: "Residents",
    invite: "Invite a Resident",
    settings: "Home settings",
    settingsHint: "Planning time and time zone",
    leave: "Leave this Home",
    you: "You",
    streak: "11 days",
    done: "3 done today",
    error: "Something went wrong loading the Residents. Try again in a moment.",
    retry: "Try again",
    me: "Me",
  },
] as const;

const state = signedInResident();
state.residents = [
  { id: "resident-1", you: true, name: "resident", photoUrl: null, streak: 6, doneToday: 2 },
  { id: "resident-2", you: false, name: "Bruna Souza", photoUrl: null, streak: 11, doneToday: 3 },
];

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: state });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    test("the sections come in order: Residents, Invite, Home settings, Leave", async ({ page }) => {
      await visit(page, "/home");
      const residents = page.getByRole("region", { name: l.residents, exact: true });
      await expect(residents).toBeVisible();
      const tops: number[] = [];
      for (const locator of [
        residents,
        page.getByRole("heading", { name: l.invite, level: 3 }),
        page.getByRole("button", { name: l.settings, exact: true }),
        page.getByRole("button", { name: l.leave, exact: true }),
      ]) {
        await expect(locator).toBeVisible();
        tops.push((await locator.boundingBox())!.y);
      }
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      // Leave Home sits at the start (left) of its row, inside the card's padding.
      const card = (await residents.boundingBox())!;
      expect((await page.getByRole("button", { name: l.leave, exact: true }).boundingBox())!.x).toBeLessThan(card.x + 32);
    });

    test("rows show the name, Streak and done-today count, in the API's order, and 'You' opens Me", async ({ page }) => {
      await visit(page, "/home");
      const items = page.getByRole("region", { name: l.residents, exact: true }).getByRole("listitem");
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText("resident");
      await expect(items.nth(0)).toContainText(l.you);
      await expect(items.nth(0)).toContainText("R");
      await expect(items.nth(1)).toContainText("Bruna Souza");
      await expect(items.nth(1)).toContainText(l.streak);
      await expect(items.nth(1)).toContainText(l.done);
      await expect(items.nth(1)).not.toContainText(l.you);

      await expect(items.nth(0).getByRole("link")).toHaveAttribute("href", "/me");
      await expect(items.nth(1).getByRole("link")).toHaveAttribute("href", "/home/residents/resident-2");

      await items.nth(0).getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === "/me");
    });

    test("Home settings starts closed and the whole head row opens it", async ({ page }) => {
      await visit(page, "/home");
      const head = page.getByRole("button", { name: l.settings, exact: true });
      await expect(head).toHaveAttribute("aria-expanded", "false");
      await expect(head).toContainText(l.settingsHint);
      await expect(page.getByLabel(/^(Timezone|Fuso horário)$/)).toBeHidden();
      await head.click();
      await expect(head).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel(/^(Timezone|Fuso horário)$/)).toBeVisible();
    });

    test("a Home of one shows only the caller's row", async ({ page, fakeApi }) => {
      fakeApi.state.residents = [fakeApi.state.residents![0]!];
      await visit(page, "/home");
      const items = page.getByRole("region", { name: l.residents, exact: true }).getByRole("listitem");
      await expect(items).toHaveCount(1);
      await expect(items.first()).toContainText(l.you);
    });

    test("while the list is held the card shows skeleton rows of the same size, and nothing moves on arrival", async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(/\/home\/residents$/, async (route) => {
        await held;
        await route.fallback();
      });
      await visit(page, "/home");

      const card = page.getByRole("region", { name: l.residents, exact: true });
      const skeleton = card.locator('ul[aria-hidden="true"]');
      await expect(skeleton).toBeVisible();
      await expect(skeleton.locator("li")).toHaveCount(2);
      // Everything else on the tab is there while the list is held.
      await expect(page.getByRole("heading", { name: l.invite, level: 3 })).toBeVisible();
      await expect(page.getByRole("button", { name: l.settings, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: l.leave, exact: true })).toBeVisible();

      const before = (await card.boundingBox())!;
      const inviteBefore = (await page.getByRole("heading", { name: l.invite, level: 3 }).boundingBox())!;
      release();
      await expect(card.getByRole("link")).toHaveCount(2);
      const after = (await card.boundingBox())!;
      const inviteAfter = (await page.getByRole("heading", { name: l.invite, level: 3 }).boundingBox())!;
      expect(after.height).toBeCloseTo(before.height, 0);
      expect(inviteAfter.y).toBeCloseTo(inviteBefore.y, 0);
    });

    test("a failed list shows an inline error with Retry, and the rest of the tab works", async ({ page, fakeApi }) => {
      fakeApi.override("GET /home/residents", json(500, { error: "internal error" }), { once: true });
      await visit(page, "/home");
      const card = page.getByRole("region", { name: l.residents, exact: true });
      await expect(card.getByRole("alert")).toHaveText(l.error);
      await expect(page.getByRole("heading", { name: l.invite, level: 3 })).toBeVisible();
      await expect(page.getByRole("button", { name: l.settings, exact: true })).toBeVisible();

      await card.getByRole("button", { name: l.retry }).click();
      await expect(card.getByRole("link")).toHaveCount(2);
      await expect(card.getByRole("alert")).toHaveCount(0);
    });
  });
}
