import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { residentsHandlers } from "../mocks/handlers/residents";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident, thirtyDayHistory } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";

// What this covers, in both locales and at the largest text size: Me's "My Completions" section. The last 30 days by
// day, newest first, with the older days dated; the "with" line of a two-person Completion; the neutral empty state;
// the skeleton while the detail is held, with the rest of Me usable; a failed detail with Retry that recovers while
// the other cards work; a failed Residents list that offers Retry and never says "nothing completed"; no section
// no action on a Completion; and the shared query key (no second detail read inside staleTime, a deep link to your
// own id redirecting to Me).

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    home: "Lar",
    heading: "Minhas conclusões",
    today: "Hoje",
    yesterday: "Ontem",
    older: ["quarta-feira, 2 de janeiro", "segunda-feira, 17 de dezembro"],
    vacuumMeta: "Pisos · 9:15, com Bruna Souza",
    empty: "Nada concluído nos últimos 30 dias.",
    error: "Não foi possível carregar suas conclusões. Tente de novo em instantes.",
    retry: "Tentar novamente",
    baseline: "Energia base",
  },
  {
    locale: "en-US",
    me: "Me",
    home: "Home",
    heading: "My Completions",
    today: "Today",
    yesterday: "Yesterday",
    older: ["Wednesday, January 2", "Monday, December 17"],
    vacuumMeta: "Floors · 9:15 AM, with Bruna Souza",
    empty: "Nothing completed in the last 30 days.",
    error: "Could not load your Completions. Try again in a moment.",
    retry: "Try again",
    baseline: "Baseline",
  },
] as const;

const withHistory = () => {
  const state = signedInResident();
  state.residents![0]!.completions = thirtyDayHistory();
  return state;
};

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
const detailReads = (requests: { method: string; path: string }[]) => requests.filter((r) => r.method === "GET" && r.path === "/home/residents/resident-1");
// The largest text size: the root font size doubled, so every rem grows with it.
const largestText = (page: Page) => page.addInitScript(() => void document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%")));

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: withHistory() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await largestText(page);
    });

    async function openMe(page: Page, baseURL: string | undefined) {
      await launchApp(page, baseURL!);
      await nav(page, l.me).click();
    }

    test("shows the last 30 days by day, newest first, older days dated, and who a Completion was done with", async ({ page, baseURL }) => {
      await openMe(page, baseURL);
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      await expect(page.getByRole("heading", { level: 4 })).toHaveText([l.today, l.yesterday, ...l.older]);

      const cards = page.getByRole("listitem").filter({ hasText: " · " });
      await expect(cards).toHaveCount(5);
      await expect(cards.nth(0)).toContainText("Deep clean the shower");
      await expect(cards.nth(1)).toContainText("Vacuum the living room");
      await expect(cards.nth(1)).toContainText(l.vacuumMeta);
      await expect(cards.nth(2)).toContainText("Clean the stove");
      await expect(cards.nth(3)).toContainText("Wash the dishes");
      await expect(cards.nth(4)).toContainText("Mop the floors");
      await expect(page.getByText("Old chore")).toHaveCount(0);
    });

    test("has no action on a Completion and nothing is cut off", async ({ page, baseURL }) => {
      await openMe(page, baseURL);
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      const section = page.getByRole("region", { name: l.heading });
      await expect(section.getByRole("button")).toHaveCount(0);
      await expect(section.getByRole("link")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test.describe("with nothing completed", () => {
      test.use({ fakeState: signedInResident() });

      test("shows a calm line and leaves the other cards alone", async ({ page, baseURL }) => {
        await openMe(page, baseURL);
        await expect(page.getByText(l.empty)).toBeVisible();
        await expect(page.getByText(l.empty)).not.toContainText("!");
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 4 })).toHaveCount(0);
        await expect(page.getByRole("button", { name: l.baseline })).toBeVisible();
      });
    });

    test("holds a skeleton while the history loads, with the rest of Me usable", async ({ page, baseURL }) => {
      const held = hold(page, /\/home\/residents\/resident-1$/);
      await openMe(page, baseURL);
      await expect(page.getByTestId("my-completions-skeleton")).toBeVisible();
      const baseline = page.getByRole("button", { name: l.baseline });
      await baseline.click();
      await expect(baseline).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText(l.empty)).toHaveCount(0);

      held.release();
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      await expect(page.getByTestId("my-completions-skeleton")).toHaveCount(0);
    });

    test("a failed read shows the message and Retry, the other cards work, and Retry recovers", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/residents/{id}", json(500, { error: "internal error" }), { once: true });
      await openMe(page, baseURL);
      await expect(page.getByRole("alert").filter({ hasText: l.error })).toBeVisible();
      const baseline = page.getByRole("button", { name: l.baseline });
      await baseline.click();
      await expect(baseline).toHaveAttribute("aria-expanded", "true");

      await page.getByRole("button", { name: l.retry }).click();
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    test("a failed Residents list offers Retry that reloads it, and never says nothing was completed", async ({ page, baseURL, fakeApi }) => {
      // The list fails on every read until the failure shows: how often the Shell reads it before Me depends on timing (ADR 0016).
      fakeApi.override("GET /home/residents", json(500, { error: "internal error" }));
      await openMe(page, baseURL);
      await expect(page.getByRole("alert").filter({ hasText: l.error })).toBeVisible();
      await expect(page.getByText(l.empty)).toHaveCount(0);
      expect(detailReads(fakeApi.requests)).toHaveLength(0);

      fakeApi.use(residentsHandlers);
      await page.getByRole("button", { name: l.retry }).click();
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
    });

    test("opening your own id redirects to Me without a second read of the history", async ({ page, baseURL, fakeApi }) => {
      await openMe(page, baseURL);
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      expect(detailReads(fakeApi.requests)).toHaveLength(1);

      // In the app, as a link would: leave Me for Home, then go to your own Resident page.
      await nav(page, l.home).click();
      await page.evaluate(() => {
        history.pushState({}, "", "/home/residents/resident-1");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await expect(page).toHaveURL((url) => url.pathname === "/me");
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      expect(detailReads(fakeApi.requests)).toHaveLength(1);
    });

    test("a deep link to your own id lands on Me with the history, read once", async ({ page, fakeApi }) => {
      await visit(page, "/home/residents/resident-1");
      await expect(page).toHaveURL((url) => url.pathname === "/me");
      await expect(page.getByRole("heading", { name: l.heading, level: 3 })).toBeVisible();
      expect(detailReads(fakeApi.requests)).toHaveLength(1);
    });
  });
}
