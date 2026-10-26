import { test, expect } from "../fixtures";
import type { FakeApi } from "../mocks/api";
import { catalogHandlers } from "../mocks/handlers/catalog";
import { homeHandlers } from "../mocks/handlers/home";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { residentsHandlers } from "../mocks/handlers/residents";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { todayHandlers } from "../mocks/handlers/today";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { onboarding } from "../pages/onboarding";
import { shell } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers (ADR 0016): launching on Today with a stored session starts the Day Plan, Check-in, Streak,
// Residents, Demands, onboarding and Home reads together, before the Home has answered, and each is asked once.
// Other paths start none of them, and a person still in onboarding sees no error from the reads that answer "none".

const TODAY_READS = ["/me/onboarding", "/home/day-plan", "/home/check-in", "/home/streak", "/home/residents", "/demands"];

const count = (api: FakeApi, path: string) => api.requests.filter((r) => r.method === "GET" && r.path === path).length;
const asked = (api: FakeApi, path: string) => count(api, path) > 0;

test.describe("signed in with a Home", () => {
  test.use({ fakeState: signedInResident() });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(signedInHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  test("Today's reads start while the Home is still unanswered, and each is asked once", async ({ page, baseURL, fakeApi }) => {
    const home = hold(page, /\/home$/);
    await launchApp(page, baseURL!);

    for (const path of TODAY_READS) await expect.poll(() => asked(fakeApi, path), { message: path }).toBe(true);
    // The Home is held: nothing has been shown from it, yet every read that does not need it has started.
    await expect(tabs.today.heading(page)).toHaveCount(0);

    home.release();
    await expect(tabs.today.mine(page)).toBeVisible();
    await expect(page.getByText("Bruna Souza")).toBeVisible();

    for (const path of ["/me", "/home", ...TODAY_READS]) expect(count(fakeApi, path), path).toBe(1);
  });

  test("another path starts no Today read before its own content shows", async ({ page, baseURL, fakeApi }) => {
    await visit(page, new URL("/chores", baseURL!).toString());

    await expect(tabs.chores.heading(page)).toBeVisible();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
    // The Residents are not on this list: the Shell reads them on every tab, as before. Nor is the Streak: the
    // top bar reads it on every tab once the Home answers, but the launch wave is Today's only (ADR 0016).
    for (const path of ["/home/day-plan", "/home/check-in"]) {
      expect(asked(fakeApi, path), path).toBe(false);
    }
    await expect(page.getByTestId("top-bar").getByRole("button")).toBeVisible();
    expect(count(fakeApi, "/home/streak")).toBe(1);
  });
});

test.describe("still in onboarding", () => {
  test.use({ fakeState: { ...signedInResident(), home: null, onboardingStored: "preferences" } });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(onboardingHandlers);
    fakeApi.use(homeHandlers);
    fakeApi.use(catalogHandlers);
    fakeApi.use(todayHandlers);
    fakeApi.use(residentsHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  test("lands on their step with no alert, then reads Today again once the Home exists", async ({ page, baseURL, fakeApi }) => {
    await launchApp(page, baseURL!);

    await expect(page).toHaveURL(/\/welcome\/home$/);
    await onboarding.expectOnStep(page, "Create your Home", 5, 5);
    // The launch reads ran and were told there is no Home; the person sees none of that.
    for (const path of ["/home/day-plan", "/home/check-in", "/home/streak", "/home/residents"]) {
      await expect.poll(() => count(fakeApi, path), { message: path }).toBe(1);
    }
    await expect(page.getByRole("alert")).toHaveCount(0);

    await onboarding.completeHomeSettings(page, { timezone: "Europe/Lisbon", allocationTime: "07:30" });
    await onboarding.suggestChores(page);
    await onboarding.createHome(page);
    await onboarding.dismissStartChoice(page);
    await shell.expectOnToday(page);

    // The cached "none" answers did not outlive the new Home: Today read them again and shows them.
    for (const path of ["/home/day-plan", "/home/check-in", "/home/streak"]) {
      expect(count(fakeApi, path), path).toBe(2);
    }
    await expect(tabs.today.mine(page)).toBeVisible();
    // The page keeps an empty alert region; none of them says anything.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });
});
