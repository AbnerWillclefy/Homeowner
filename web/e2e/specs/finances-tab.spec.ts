import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";

// What this covers, in both locales: the Finances tab shows as the fifth tab only when GET /me says `finance: true`,
// opens an empty state, survives a rename (PUT /me/name answers the flag too), and is absent for everyone else, where
// /finances goes to Today and the Finances chunk is never requested. At 320px with the root font at 200% the label
// wraps and is never truncated, and all five tabs stay at least 44px tall.

const LOCALES = [
  { locale: "pt-BR", tab: "Finanças", empty: "Suas finanças são só suas. Conecte seus bancos para começar.", today: "Hoje", me: "Eu", edit: "Editar nome e foto", nameLabel: "Nome", save: "Salvar" },
  { locale: "en-US", tab: "Finances", empty: "Your finances are yours alone. Connect your banks to start.", today: "Today", me: "Me", edit: "Edit name and photo", nameLabel: "Name", save: "Save" },
] as const;

const state = (finance: boolean) => {
  const s = signedInResident();
  s.user.finance = finance;
  s.user.displayName = "Abner Lima"; // so Me offers "Edit name and photo"
  s.residents![0]!.name = "Abner Lima";
  return s;
};

const links = (page: Page) => page.getByRole("navigation").getByRole("link");

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    test.describe("with the flag", () => {
      test.use({ fakeState: state(true) });

      test("shows five tabs, Finances last, and opens the empty state", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(links(page)).toHaveCount(5);
        await expect(links(page).last()).toHaveText(l.tab);

        await links(page).last().click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances");
        await expect(links(page).last()).toHaveAttribute("aria-current", "page");
        await expect(page.getByText(l.empty, { exact: true })).toBeVisible();

        // Once the chunk is loaded, opening the tab again puts focus on its heading (useFocusOnNavigate).
        await links(page).first().click();
        await links(page).last().click();
        await expect(page.getByRole("heading", { level: 2, name: l.tab, exact: true })).toBeFocused();
      });

      test("a deep link to /finances stays", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByText(l.empty, { exact: true })).toBeVisible();
      });

      test("keeps the tab after a rename", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await page.getByRole("navigation").getByRole("link", { name: l.me, exact: true }).click();
        await page.getByRole("link", { name: l.edit }).click();
        await page.getByLabel(l.nameLabel, { exact: true }).fill("Bia Costa");
        await page.getByRole("button", { name: l.save }).click();
        await expect(page).toHaveURL(/\/me$/);
        await expect(links(page)).toHaveCount(5);
        await expect(links(page).last()).toHaveText(l.tab);
      });

      test("at 320px and the largest text the label wraps, is not truncated, and every tab stays tappable", async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await launchApp(page, baseURL!);
        await expect(links(page)).toHaveCount(5);
        for (const link of await links(page).all()) {
          const box = (await link.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          const label = link.locator("span");
          expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
          expect(await label.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe("ellipsis");
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    });

    test.describe("without the flag", () => {
      test.use({ fakeState: state(false) });

      test("shows four tabs, and /finances lands on Today with nothing of Finances", async ({ page, baseURL }) => {
        const chunks: string[] = [];
        page.on("request", (request) => {
          if (/Finances/.test(new URL(request.url()).pathname)) chunks.push(request.url());
        });
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page).toHaveURL((url) => url.pathname === "/");
        await expect(links(page)).toHaveCount(4);
        await expect(links(page).first()).toHaveText(l.today);
        await expect(page.getByText(l.tab)).toHaveCount(0);
        await expect(page.getByText(l.empty)).toHaveCount(0);
        expect(chunks).toEqual([]);
      });
    });
  });
}
