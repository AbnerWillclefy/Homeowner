import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json, signedIn } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, SECOND_RESIDENT_EMAIL, secondResident, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { GOOD_PASSWORD } from "../mocks/users";
import { launchApp } from "../pages/launch";

// What this covers: the data layer end to end, in pt-BR and then en-US. Coming back to Today shows the cached plan at
// once (no skeleton) with the Refreshing indicator while the refetch is held; a Task action sends no new read of the
// plan; a different Resident signing in on the same device never sees the first one's data; and resuming the page
// (visibilitychange) refetches the current page. The network is faked with page.route and the fake API, never real.

const LOCALES = [
  {
    locale: "pt-BR",
    chores: "Afazeres",
    today: "Hoje",
    me: "Eu",
    refreshing: "Atualizando",
    committed: "Assumida",
    signOut: "Sair",
    email: "E-mail",
    password: "Senha",
    signIn: "Entrar",
    accept: (task: string) => `Aceitar ${task}`,
  },
  {
    locale: "en-US",
    chores: "Chores",
    today: "Today",
    me: "Me",
    refreshing: "Refreshing",
    committed: "Committed",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    accept: (task: string) => `Accept ${task}`,
  },
] as const;

const FIRST_NAME = "Ana Alvarenga";
const SECOND_NAME = "Beto Bezerra";
const DISHES = "Wash the dishes";

const DAY_PLAN = /\/home\/day-plan$/;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.state.user.displayName = FIRST_NAME;
      fakeApi.state.residents![0]!.name = FIRST_NAME;
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const tab = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
    const skeleton = (page: Page) => page.getByTestId("day-plan-skeleton");
    const refreshing = (page: Page) => page.getByRole("img", { name: l.refreshing });
    const dishes = (page: Page) => page.getByText(DISHES, { exact: true });
    const planReads = (requests: { method: string; path: string }[]) =>
      requests.filter((r) => r.method === "GET" && r.path === "/home/day-plan").length;

    test("coming back to Today shows the cached plan with no skeleton, and the indicator only while the refetch is held", async ({ page, baseURL }) => {
      // First load, held: the skeleton shows. This proves the locator finds it, so its absence below means something.
      const first = hold(page, DAY_PLAN);
      await launchApp(page, baseURL!);
      await expect(skeleton(page)).toBeVisible();
      first.release();
      await expect(dishes(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);

      await tab(page, l.chores).click();
      await expect(page.getByText("Mop the floors", { exact: true })).toBeVisible();
      await expect(tab(page, l.chores)).toHaveAttribute("aria-current", "page");

      const second = hold(page, DAY_PLAN);
      await tab(page, l.today).click();
      // The cached Tasks are there at once, and the skeleton never replaces them.
      await expect(dishes(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);
      // The indicator is delayed by 300ms: the web-first assertion waits for it, no sleep.
      await expect(refreshing(page)).toBeVisible();
      await expect(dishes(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);

      second.release();
      await expect(refreshing(page)).toHaveCount(0);
      await expect(dishes(page)).toBeVisible();
    });

    test("accepting a Proposed Task marks it Committed and sends no new read of the plan", async ({ page, baseURL, fakeApi }) => {
      // The fake has no Task actions yet: accept answers the plan with the Task Committed, as the API does.
      fakeApi.on(
        "POST /home/tasks/{id}/accept",
        signedIn((request, state) => {
          const task = state.dayPlan!.mine.find((candidate) => candidate.id === request.params.id);
          if (!task) return json(404, { error: "not_found" });
          task.committed = true;
          return json(200, state.dayPlan);
        }),
      );
      await launchApp(page, baseURL!);
      await expect(dishes(page)).toBeVisible();
      const readsBefore = planReads(fakeApi.requests);
      expect(readsBefore).toBeGreaterThan(0);

      await page.getByRole("button", { name: l.accept(DISHES), exact: true }).click();
      const card = page.getByRole("listitem").filter({ hasText: DISHES });
      await expect(card.getByText(l.committed, { exact: true })).toBeVisible();
      expect(fakeApi.requests.filter((r) => r.method === "POST" && r.path === "/home/tasks/task-1/accept")).toHaveLength(1);
      expect(planReads(fakeApi.requests)).toBe(readsBefore);
    });

    test("a different Resident signing in after sign-out never sees the first one's data", async ({ page, baseURL, fakeApi, fakeCognito }) => {
      await launchApp(page, baseURL!);
      await expect(dishes(page)).toBeVisible();
      await expect(page.getByText(FIRST_NAME).first()).toBeVisible();

      await tab(page, l.me).click();
      await page.getByRole("button", { name: l.signOut, exact: true }).click();
      await expect(page.getByLabel(l.password, { exact: true })).toBeVisible();

      // The server now answers for Resident B: another name, Home and Tasks.
      // The fake's handlers hold its state object, so the new Resident's state is copied over it in place.
      Object.assign(fakeApi.state, secondResident());
      fakeCognito.addUser({ email: SECOND_RESIDENT_EMAIL, password: GOOD_PASSWORD, confirmed: true });

      const loading = hold(page, DAY_PLAN);
      await page.getByLabel(l.email, { exact: true }).fill(SECOND_RESIDENT_EMAIL);
      await page.getByLabel(l.password, { exact: true }).fill(GOOD_PASSWORD);
      await page.getByRole("button", { name: l.signIn, exact: true }).click();

      // During B's first load: the shell is up, B's plan is still held, and nothing of A shows.
      await expect(tab(page, l.today)).toBeVisible();
      await expect(page.getByText(FIRST_NAME)).toHaveCount(0);
      await expect(dishes(page)).toHaveCount(0);

      loading.release();
      await expect(page.getByText("Water the plants", { exact: true })).toBeVisible();
      await expect(page.getByText(SECOND_NAME).first()).toBeVisible();
      await expect(page.getByText(FIRST_NAME)).toHaveCount(0);
      await expect(dishes(page)).toHaveCount(0);
    });

    test("resuming the page refetches the current page", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(dishes(page)).toBeVisible();
      const before = planReads(fakeApi.requests);

      // A PWA coming back fires visibilitychange. It bubbles from document to window, where React Query listens, and
      // visibilityState stays "visible", so it counts as focused.
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
      await expect.poll(() => planReads(fakeApi.requests)).toBe(before + 1);
      await expect(dishes(page)).toBeVisible();
    });
  });
}
