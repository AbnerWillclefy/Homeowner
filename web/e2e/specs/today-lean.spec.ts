import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident, withExplanation } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the lean Today. Under the top bar it opens with "Your Tasks" and its count, then the day's summary
// as one muted line (plain text, not a control), then the Tasks. The summary names its source as visually hidden
// text, shows nothing before planning or on a rejected run, and wraps at 320px with a long headline. The greeting,
// the Energy card and the Check-in card are gone. Each test runs in pt-BR first, then en-US.

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
    mine: "Suas tarefas",
    gone: [/Bom dia|Boa tarde|Boa noite/, "Como você está hoje?", "Mudar", /^Energia \d/],
  },
  {
    locale: "en-US",
    headline: "A light day for you",
    detail: "Two small Tasks, and the rest can wait.",
    llm: "Written by the assistant",
    template: "Standard summary of today's reasons",
    mine: "Your Tasks",
    gone: [/Good (morning|afternoon|evening)/, "How are you today?", "Change", /^Energy \d/],
  },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: withExplanation(signedInResident(), "llm") });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const summary = (page: import("@playwright/test").Page) => page.locator("p", { hasText: l.headline });

    test("the title comes first, then the summary line, then the Tasks", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(summary(page)).toBeVisible();
      const heading = await page.getByRole("heading", { level: 2, name: new RegExp(l.mine) }).boundingBox();
      const line = await summary(page).boundingBox();
      const task = await page.getByText("Wash the dishes", { exact: true }).boundingBox();
      expect(heading!.y).toBeLessThan(line!.y);
      expect(line!.y).toBeLessThan(task!.y);
      // The summary is a line of text, not a control, and not a heading.
      await expect(page.getByRole("button", { name: l.headline })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: l.headline })).toHaveCount(0);
      await expect(page.getByText(l.detail, { exact: true })).toHaveCount(0);
    });

    test("the greeting, the date, the Energy card and the Check-in card are gone", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(summary(page)).toBeVisible();
      for (const text of l.gone) await expect(page.getByText(text)).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Check-in" })).toHaveCount(0);
    });

    test("the model-written text names its source as hidden text", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(summary(page)).toBeVisible();
      await expect(summary(page)).toContainText(l.llm);
      await expect(summary(page).getByText(l.llm)).toHaveClass(/sr-only/);
    });

    test.describe("standard text", () => {
      test.use({ fakeState: withExplanation(signedInResident(), "template") });

      test("names its source as hidden text", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(summary(page)).toBeVisible();
        await expect(summary(page).getByText(l.template)).toHaveClass(/sr-only/);
      });
    });

    test.describe("before planning", () => {
      test.use({ fakeState: (() => { const s = signedInResident(); delete s.dayPlan; return s; })() });

      test("shows the title with no count and no summary", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByRole("heading", { level: 2, name: l.mine, exact: true })).toBeVisible();
        await expect(page.getByText(l.headline)).toHaveCount(0);
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

      test("shows the title and no summary", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByRole("heading", { level: 2, name: l.mine, exact: true })).toBeVisible();
        await expect(page.getByText(l.headline)).toHaveCount(0);
      });
    });

    test.describe("320px with a long headline", () => {
      test.use({
        viewport: { width: 320, height: 640 },
        fakeState: withExplanation(signedInResident(), "llm", LONG_HEADLINE),
      });

      test("wraps the headline without scrolling sideways", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.locator("p", { hasText: LONG_HEADLINE[l.locale] })).toBeVisible();
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflows).toBe(false);
      });
    });
  });
}
