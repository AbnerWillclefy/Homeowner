import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident, withExplanation } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the leaner Today. The folded explanation sits under "Your Tasks" and before the Tasks, closed
// by default, opens with Enter and closes with Space, names its source with a hidden description and a visible
// caption, shows nothing before planning or on a rejected run, is not remembered, and holds at 320px with a long
// headline. Each test runs in pt-BR first, then en-US.

const LONG_HEADLINE = {
  "en-US": "A very long headline that goes on and on about why today looks the way it does for everybody here",
  "pt-BR": "Um título muito comprido que continua explicando por que o dia de hoje está desenhado desta maneira para todos",
};

const LOCALES = [
  {
    locale: "pt-BR",
    headline: "Um dia leve para você",
    detail: "Duas tarefas pequenas, o resto pode esperar.",
    llm: "Escrito pelo assistente",
    template: "Resumo padrão dos motivos de hoje",
    prompt: "Como você está hoje?",
    mine: "Suas tarefas",
  },
  {
    locale: "en-US",
    headline: "A light day for you",
    detail: "Two small Tasks, and the rest can wait.",
    llm: "Written by the assistant",
    template: "Standard summary of today's reasons",
    prompt: "How are you today?",
    mine: "Your Tasks",
  },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: withExplanation(signedInResident(), "llm") });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const toggle = (page: import("@playwright/test").Page) => page.getByRole("button", { name: l.headline, exact: true });

    test("the Check-in comes first, then the summary, then the Tasks", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(toggle(page)).toBeVisible();
      const checkIn = await page.getByText(l.prompt, { exact: true }).boundingBox();
      const heading = await page.getByRole("heading", { level: 3, name: new RegExp(l.mine) }).boundingBox();
      const summary = await toggle(page).boundingBox();
      const task = await page.getByText("Wash the dishes", { exact: true }).boundingBox();
      expect(checkIn!.y).toBeLessThan(heading!.y);
      expect(heading!.y).toBeLessThan(summary!.y);
      expect(summary!.y).toBeLessThan(task!.y);
      await expect(page.getByRole("heading", { level: 4, name: l.headline })).toBeVisible();
    });

    test("it starts closed and opens with Enter and closes with Space, without moving the toggle", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const button = toggle(page);
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByText(l.detail, { exact: true })).toBeHidden();
      const before = (await button.boundingBox())!.y;

      await button.focus();
      await page.keyboard.press("Enter");
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText(l.detail, { exact: true })).toBeVisible();
      expect((await button.boundingBox())!.y).toBe(before);
      await expect(button).toBeFocused();

      await page.keyboard.press("Space");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByText(l.detail, { exact: true })).toBeHidden();
      expect((await button.boundingBox())!.y).toBe(before);
    });

    test("the model-written text names its source, described and as a caption", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(toggle(page)).toHaveAccessibleDescription(l.llm);
      const caption = page.locator("p").getByText(l.llm, { exact: true });
      await expect(caption).toBeHidden();
      await toggle(page).click();
      await expect(caption).toBeVisible();
    });

    test.describe("standard text", () => {
      test.use({ fakeState: withExplanation(signedInResident(), "template") });

      test("names its source, described and as a caption", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(toggle(page)).toHaveAccessibleDescription(l.template);
        await toggle(page).click();
        await expect(page.locator("p").getByText(l.template, { exact: true })).toBeVisible();
      });
    });

    test.describe("before planning", () => {
      test.use({ fakeState: (() => { const s = signedInResident(); delete s.dayPlan; return s; })() });

      test("shows no summary card", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByText(l.prompt, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { expanded: false, name: l.headline })).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 4 })).toHaveCount(0);
      });
    });

    test.describe("rejected run", () => {
      test.use({
        fakeState: (() => {
          const s = signedInResident();
          s.dayPlan = { ...s.dayPlan!, planned: false, rejected: true, mine: [], others: [], pool: [] };
          return s;
        })(),
      });

      test("shows no summary card", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByText(l.prompt, { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { level: 4 })).toHaveCount(0);
        await expect(page.getByText(l.headline)).toHaveCount(0);
      });
    });

    test("the open state is not remembered", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      const links = page.getByRole("navigation").getByRole("link");
      await links.nth(1).click();
      await expect(page).toHaveURL((url) => url.pathname === "/chores");
      await links.nth(0).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    });

    test.describe("320px with a long headline", () => {
      test.use({
        viewport: { width: 320, height: 640 },
        fakeState: withExplanation(signedInResident(), "llm", LONG_HEADLINE),
      });

      test("wraps the headline without scrolling sideways", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByRole("button", { name: LONG_HEADLINE[l.locale], exact: true })).toBeVisible();
        await page.getByRole("button", { name: LONG_HEADLINE[l.locale], exact: true }).click();
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflows).toBe(false);
      });
    });
  });
}
