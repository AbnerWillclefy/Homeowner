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

// What this covers (ADR 0016): launching on Today with a stored session asks the API once, `GET /boot`, for the
// Day Plan, Check-in, Streak, Residents, Demands, onboarding, Me and Home reads together, and the hooks take their
// answers from it. A boot that fails, or a section that fails, falls back to that read's own endpoint. Other paths
// start none of it, and a person still in onboarding sees no error from the reads that answer "none".

const TODAY_READS = ["/me/onboarding", "/home/day-plan", "/home/check-in", "/home/streak", "/home/residents", "/demands"];

const ALL_READS = ["/me", "/home", ...TODAY_READS];

const count = (api: FakeApi, path: string) => api.requests.filter((r) => r.method === "GET" && r.path === path).length;

test.describe("signed in with a Home", () => {
  test.use({ fakeState: signedInResident() });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(signedInHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  test("Today's reads are one GET /boot, held until it answers, and no read of their own", async ({ page, baseURL, fakeApi }) => {
    const boot = hold(page, /\/boot(\?|$)/);
    const asked = page.waitForRequest(/\/boot(\?|$)/);
    await launchApp(page, baseURL!);

    await asked;
    await expect(tabs.today.heading(page)).toHaveCount(0);

    boot.release();
    await expect(tabs.today.mine(page)).toBeVisible();
    await expect(page.getByText("Bruna Souza")).toBeVisible();

    expect(count(fakeApi, "/boot")).toBe(1);
    for (const path of ALL_READS) expect(count(fakeApi, path), path).toBe(0);
  });

  test("a boot that fails sends each read to its own endpoint, once", async ({ page, baseURL, fakeApi }) => {
    fakeApi.override("GET /boot", { status: 500, body: { error: "internal error" } });
    await launchApp(page, baseURL!);

    await expect(tabs.today.mine(page)).toBeVisible();
    for (const path of ALL_READS) expect(count(fakeApi, path), path).toBe(1);
  });

  test("a section that fails is asked for on its own, and only that one", async ({ page, baseURL, fakeApi }) => {
    fakeApi.override("GET /home/streak", { status: 500, body: { error: "internal error" } }, { once: true });
    await launchApp(page, baseURL!);

    await expect(tabs.today.mine(page)).toBeVisible();
    await expect.poll(() => count(fakeApi, "/home/streak")).toBe(1);
    for (const path of ALL_READS.filter((p) => p !== "/home/streak")) expect(count(fakeApi, path), path).toBe(0);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test("a read after the boot, a resume, goes to its own endpoint", async ({ page, baseURL, fakeApi }) => {
    await launchApp(page, baseURL!);
    await expect(tabs.today.mine(page)).toBeVisible();
    expect(count(fakeApi, "/home/day-plan")).toBe(0);

    // Each section was used up by the launch, so the refetch a resume starts is not served from the boot.
    await expect(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
      expect(count(fakeApi, "/home/day-plan")).toBeGreaterThan(0);
    }).toPass();
    expect(count(fakeApi, "/boot")).toBe(1);
  });

  test("another path starts no Today read before its own content shows", async ({ page, baseURL, fakeApi }) => {
    await visit(page, new URL("/chores", baseURL!).toString());

    await expect(tabs.chores.heading(page)).toBeVisible();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
    // The Shell reads the Residents, the Streak, the Check-in and the Day Plan on every tab once the Home answers
    // (the top bar needs them), but the launch wave is Today's only (ADR 0016). Each is asked once, not twice.
    await expect(page.getByTestId("top-bar").getByRole("button", { name: /check-in|check in/i })).toBeVisible();
    for (const path of ["/home/day-plan", "/home/check-in", "/home/streak"]) {
      await expect.poll(() => count(fakeApi, path), { message: path }).toBe(1);
    }
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
    // The launch reads ran inside the boot and were told there is no Home; the person sees none of that.
    expect(count(fakeApi, "/boot")).toBe(1);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await onboarding.completeHomeSettings(page, { timezone: "Europe/Lisbon", allocationTime: "07:30" });
    await onboarding.suggestChores(page);
    await onboarding.createHome(page);
    await onboarding.dismissStartChoice(page);
    await shell.expectOnToday(page);

    // The cached "none" answers did not outlive the new Home: the boot's sections were used up, so Today read them
    // from their own endpoints and shows them.
    for (const path of ["/home/day-plan", "/home/check-in", "/home/streak"]) {
      expect(count(fakeApi, path), path).toBe(1);
    }
    await expect(tabs.today.mine(page)).toBeVisible();
    // The page keeps an empty alert region; none of them says anything.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });
});
