import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell, TABS } from "../pages/shell";

// What this covers: the page header that replaced the top bar. Every tab opens with Bedrock's PageHeader, its one h1
// (the logo is gone) and the place focus lands on when the tab opens; Today's header also holds the Energy pill,
// the Streak and the voice microphone, which no other tab has, and at 320px in pt-BR none of them leaves the
// screen. In pt-BR.

const TITLES: Record<(typeof TABS)[number], string> = { Today: "Suas tarefas", Chores: "Afazeres", Home: "Seu lar", Me: "Sobre você" };
const LABELS: Record<(typeof TABS)[number], string> = { Today: "Hoje", Chores: "Afazeres", Home: "Lar", Me: "Eu" };

test.use({ locale: "pt-BR", fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  fakeApi.state.streak = 5;
  await seedSession(page, { email: RESIDENT_EMAIL });
});

test("every tab has its title as the page's one h1, and no logo", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  for (const name of TABS) {
    await page.getByRole("navigation").getByRole("link", { name: LABELS[name], exact: true }).click();
    await expect(shell.title(page, TITLES[name])).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(shell.logo(page)).toHaveCount(0);
  }
});

test("focus lands on the tab's title when it opens", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  // A first pass loads every tab; on the second each shows its title at once.
  for (const pass of [1, 2]) {
    for (const name of TABS.slice(1)) {
      await page.getByRole("navigation").getByRole("link", { name: LABELS[name], exact: true }).click();
      await expect(shell.title(page, TITLES[name])).toBeVisible();
      if (pass === 2) await expect(shell.title(page, TITLES[name])).toBeFocused();
    }
    await page.getByRole("navigation").getByRole("link", { name: LABELS.Today, exact: true }).click();
    await expect(shell.title(page, TITLES.Today)).toBeVisible();
  }
});

test("only Today's header has the Energy pill, the Streak and the microphone", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  const tools = shell.todayTools(page);
  await expect(tools.getByRole("button", { name: /^Sequência: / })).toBeVisible();
  const mic = (scope: typeof page | typeof tools) => scope.locator('[data-slot="voice"]').getByRole("button");
  await expect(mic(tools)).toBeVisible();
  for (const name of TABS.filter((tab) => tab !== "Today")) {
    await page.getByRole("navigation").getByRole("link", { name: LABELS[name], exact: true }).click();
    await expect(shell.title(page, TITLES[name])).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sequência: / })).toHaveCount(0);
    await expect(mic(page)).toHaveCount(0);
  }
});

test.describe("320px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("Today's tools stay on screen with no sideways scroll, each at least 44px", async ({ page, baseURL }) => {
    await launchApp(page, baseURL!);
    const buttons = shell.todayTools(page).getByRole("button");
    await expect(buttons).toHaveCount(3);
    for (const button of await buttons.all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(shell.title(page, TITLES.Today)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("with no Home", () => {
  test.use({ fakeState: { onboardingStored: "done" } });

  test("each step of Create your Home has the screen's one h1", async ({ page, baseURL }) => {
    const h1 = page.getByRole("heading", { level: 1 });
    await launchApp(page, baseURL!);
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/lar/i);
    await page.getByRole("button", { name: "Próximo: sobre o seu lar" }).click();
    await expect(h1).toHaveText("Sobre o seu lar");
    await page.getByRole("button", { name: "Pular e adicionar afazeres depois" }).click();
    await expect(h1).toHaveText("Revise os seus afazeres");
    await expect(h1).toHaveCount(1);
  });
});
