import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers: the Home tab leads with the Residents list, in both locales. The order of the sections, the
// caller's "You" row (a name-less User, shown by the email's local part, opening Me), another Resident's link, the
// skeleton while the list is held (and no layout shift when it arrives), the inline error with Retry, and the Home
// settings Row, which opens a Sheet.

const LOCALES = [
  {
    locale: "pt-BR",
    residents: "Moradores",
    invite: "Convidar um morador",
    settings: "Ajustes do lar",
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
const rowNamed = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const regionOf = (page: Page, label: string) => page.getByRole("region", { name: new RegExp(`^${label}`) });
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

    test("the rows come in order: Residents, Invite, Home settings, Leave", async ({ page }) => {
      await visit(page, "/home");
      const residents = regionOf(page, l.residents);
      await expect(residents).toBeVisible();
      const tops: number[] = [];
      for (const locator of [
        residents.getByRole("link").first(),
        rowNamed(page, l.invite),
        rowNamed(page, l.settings),
        rowNamed(page, l.leave),
      ]) {
        await expect(locator).toBeVisible();
        tops.push((await locator.boundingBox())!.y);
      }
      // Strictly increasing: a row that moved up or sat level with another would fail.
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      expect(new Set(tops).size).toBe(4);
    });

    test("rows show the name, Streak and done-today count, in the API's order, and 'You' opens Me", async ({ page }) => {
      await visit(page, "/home");
      const items = regionOf(page, l.residents).getByRole("listitem").filter({ has: page.getByRole("link") });
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

    test("the settings Row opens a Sheet with the two settings, and Escape closes it back to the Row", async ({ page }) => {
      await visit(page, "/home");
      const row = rowNamed(page, l.settings);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await row.click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("combobox")).toHaveCount(2);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(row).toBeFocused();
    });

    test("a Home of one shows only the caller's row", async ({ page, fakeApi }) => {
      fakeApi.state.residents = [fakeApi.state.residents![0]!];
      await visit(page, "/home");
      const items = regionOf(page, l.residents).getByRole("listitem").filter({ has: page.getByRole("link") });
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

      const card = page.getByRole("region", { name: new RegExp(`^${l.residents}`) });
      const skeleton = card.locator('li[aria-hidden="true"]');
      await expect(skeleton).toHaveCount(2);
      await expect(skeleton.first()).toBeVisible();
      // Everything else on the tab is there while the list is held.
      await expect(rowNamed(page, l.invite)).toBeVisible();
      await expect(rowNamed(page, l.settings)).toBeVisible();
      await expect(rowNamed(page, l.leave)).toBeVisible();

      const before = (await card.boundingBox())!;
      const inviteBefore = (await rowNamed(page, l.invite).boundingBox())!;
      release();
      await expect(card.getByRole("link")).toHaveCount(2);
      const after = (await card.boundingBox())!;
      const inviteAfter = (await rowNamed(page, l.invite).boundingBox())!;
      expect(after.height).toBeCloseTo(before.height, 0);
      expect(inviteAfter.y).toBeCloseTo(inviteBefore.y, 0);
    });

    test("a failed list shows an inline error with Retry, and the rest of the tab works", async ({ page, fakeApi }) => {
      fakeApi.override("GET /home/residents", json(500, { error: "internal error" }), { once: true });
      await visit(page, "/home");
      const card = regionOf(page, l.residents);
      await expect(card.getByRole("alert")).toHaveText(l.error);
      await expect(rowNamed(page, l.invite)).toBeVisible();
      await expect(rowNamed(page, l.settings)).toBeVisible();

      await card.getByRole("button", { name: l.retry }).click();
      await expect(card.getByRole("link")).toHaveCount(2);
      await expect(card.getByRole("alert")).toHaveCount(0);
    });
  });
}
