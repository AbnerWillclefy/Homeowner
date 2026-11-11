import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { financeNav, financeView } from "../pages/finances";

// What this covers, in pt-BR: the Finances tab shows as the fifth tab only when GET /me says `finance: true`,
// opens an empty state, survives a rename (PUT /me/name answers the flag too), and is absent for everyone else, where
// /finances goes to Today and the Finances chunk is never requested. At 320px with the root font at 200% the label
// wraps and is never truncated, and all five tabs stay at least 44px tall.

const LOCALES = [
  { locale: "pt-BR", tab: "Finanças", empty: "Suas finanças são só suas. Conecte seus bancos para começar.", today: "Hoje", me: "Eu", edit: "Editar nome e foto", nameLabel: "Nome", save: "Salvar" },
] as const;

const state = (finance: boolean) => {
  const s = signedInResident();
  s.user.finance = finance;
  s.user.displayName = "Abner Lima"; // so Me offers "Edit name and photo"
  s.residents![0]!.name = "Abner Lima";
  return s;
};

const sourced = () => {
  const s = state(true);
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
  };
  return s;
};

const links =(page: Page) => page.getByRole("navigation").getByRole("link");

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

    test.describe("with a Source", () => {
      test.use({ fakeState: sourced() });
      const names =
        l.locale === "pt-BR"
          ? { views: ["Resumo", "Gastos", "Contas"], settings: "Ajustes de finanças", back: "Finanças", prev: "Mês anterior", month: "Outubro de 2026" }
          : { views: ["Summary", "Spending", "Bills"], settings: "Finance settings", back: "Finances", prev: "Previous month", month: "October 2026" };

      test("opens on the summary, each view is its own route, and Ajustes is a route with Back", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(financeNav(page).getByRole("link")).toHaveText(names.views);
        await expect(financeView(page, names.views[0])).toHaveAttribute("aria-current", "page");

        await financeView(page, names.views[2]).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/contas");
        await expect(financeView(page, names.views[2])).toHaveAttribute("aria-current", "page");

        await page.getByRole("link", { name: names.settings }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
        await page.getByRole("button", { name: names.back }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/contas");
        await expect(financeView(page, names.views[2])).toHaveAttribute("aria-current", "page");
      });

      test("a reload keeps the view and the picked month, and the month goes along to the other views", async ({ page, baseURL }) => {
        await page.clock.setFixedTime(new Date("2026-11-08T12:00:00-03:00"));
        await visit(page, new URL("/finances/gastos", baseURL!).toString());
        await page.getByRole("button", { name: names.prev }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/gastos" && url.search === "?month=2026-10");
        await page.reload();
        await expect(financeView(page, names.views[1])).toHaveAttribute("aria-current", "page");
        await expect(page.getByText(names.month, { exact: true })).toBeVisible();
        await financeView(page, names.views[2]).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/contas" && url.search === "?month=2026-10");
      });

      test("a reload on /finances/ajustes stays, and Back goes to Finances", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances/ajustes", baseURL!).toString());
        await expect(page.getByRole("heading", { level: 2, name: names.settings, exact: true })).toBeVisible();
        await page.getByRole("button", { name: names.back }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances");
      });

      test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByRole("link", { name: names.settings })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    });

    test.describe("without the flag", () => {
      test.use({ fakeState: state(false) });

      test("/finances/ajustes lands on Today", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances/ajustes", baseURL!).toString());
        await expect(page).toHaveURL((url) => url.pathname === "/");
      });

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
