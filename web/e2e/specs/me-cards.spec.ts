import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { tabs } from "../pages/tabs";

// What this covers: the Me tab's Baseline, Preferences and Restrictions as collapsible cards, in both locales.
// Closed on first view, the whole head row toggles, an edit inside an open card still saves, and the open state is
// not remembered. Labels are per locale because the cards are found by role and name.

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    today: "Hoje",
    cards: ["Energia base", "Preferências", "Restrições"],
    restrictions: "Restrições",
    heights: "Altura",
    saved: "Salvo.",
  },
  {
    locale: "en-US",
    me: "Me",
    today: "Today",
    cards: ["Baseline", "Preferences", "Restrictions"],
    restrictions: "Restrictions",
    heights: "Heights",
    saved: "Saved.",
  },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, fakeState: signedInResident() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await launchApp(page, baseURL!);
      await page.getByRole("navigation").getByRole("link", { name: l.me, exact: true }).click();
    });

    test("all three cards start closed", async ({ page }) => {
      for (const name of l.cards) {
        const button = tabs.me.trigger(page,name);
        await expect(button).toHaveAttribute("aria-expanded", "false");
        const body = page.locator(`#${await button.getAttribute("aria-controls")}`);
        await expect(body).toBeHidden();
        await expect(body).toBeAttached();
      }
    });

    test("the head row opens a card and Space closes it", async ({ page }) => {
      const button = tabs.me.trigger(page,l.cards[0]);
      // Click the row's left edge, on the icon tile: not the chevron, not the title text.
      const box = (await button.boundingBox())!;
      await page.mouse.click(box.x + 8, box.y + box.height / 2);
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(`#${await button.getAttribute("aria-controls")}`)).toBeVisible();

      await button.focus();
      await page.keyboard.press("Space");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Enter");
      await expect(button).toHaveAttribute("aria-expanded", "true");
    });

    test("an edit inside an open Restrictions card still saves", async ({ page, fakeApi }) => {
      await tabs.me.trigger(page,l.restrictions).click();
      await page.getByRole("checkbox", { name: l.heights }).check();

      await expect(page.getByText(l.saved)).toBeVisible();
      expect(fakeApi.requests.some((r) => r.method === "PUT" && r.path === "/me/restrictions/heights")).toBe(true);
    });

    test("leaving the tab and coming back shows the cards closed again", async ({ page }) => {
      await tabs.me.trigger(page,l.cards[2]).click();
      await expect(tabs.me.trigger(page,l.cards[2])).toHaveAttribute("aria-expanded", "true");

      await page.getByRole("navigation").getByRole("link", { name: l.today, exact: true }).click();
      await page.getByRole("navigation").getByRole("link", { name: l.me, exact: true }).click();

      for (const name of l.cards) await expect(tabs.me.trigger(page,name)).toHaveAttribute("aria-expanded", "false");
    });
  });
}
