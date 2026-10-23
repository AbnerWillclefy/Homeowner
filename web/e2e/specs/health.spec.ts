import type { FakeApi } from "../mocks/api";
import { json } from "../mocks/api";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { homeHandlers } from "../mocks/handlers/home";
import { catalogHandlers } from "../mocks/handlers/catalog";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { onboarding } from "../pages/onboarding";
import { shell } from "../pages/shell";

// What this covers: the server check behind the "can't reach the server" banner runs once per app load, whichever
// layout the Guard puts on screen (Today's page frame or the onboarding layout), and the banner's Retry re-checks
// through that one check. Signed in with a Home, and mid-onboarding.

const healthCalls = (fakeApi: FakeApi) => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/healthz");
const banner = (page: import("@playwright/test").Page) => page.getByRole("status").filter({ hasText: /\S/ });
const retry = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Try again" });

test.describe("signed in with a Home", () => {
  test.use({ fakeState: signedInResident() });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(signedInHandlers);
    await seedSession(page);
  });

  test("asks /healthz once on launch and not again when moving between tabs", async ({ page, baseURL, fakeApi }) => {
    await launchApp(page, baseURL!);
    await shell.expectOnToday(page);
    expect(healthCalls(fakeApi)).toHaveLength(1);

    await shell.openTab(page, "Chores");
    await shell.expectOnTab(page, "Chores");
    await shell.openTab(page, "Today");
    await shell.expectOnTab(page, "Today");
    expect(healthCalls(fakeApi)).toHaveLength(1);
  });

  test("an unreachable API shows the banner on Today, and Retry re-checks and clears it", async ({ page, baseURL, fakeApi }) => {
    fakeApi.override("GET /healthz", json(503, { status: "unavailable" }), { once: true });
    await launchApp(page, baseURL!);
    await shell.expectOnToday(page);
    await expect(banner(page)).toBeVisible();
    expect(healthCalls(fakeApi)).toHaveLength(1);

    await retry(page).click();
    await expect(banner(page)).toHaveCount(0);
    expect(healthCalls(fakeApi)).toHaveLength(2);
  });
});

test.describe("mid-onboarding", () => {
  // Reminders is stored, so the Guard sends the User to the Baseline step.
  test.use({ fakeState: { onboardingStored: "reminders" } });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(onboardingHandlers);
    fakeApi.use(homeHandlers);
    fakeApi.use(catalogHandlers);
    await seedSession(page);
  });

  test("asks /healthz once on launch and not again when the Guard changes layout or the step changes", async ({ page, baseURL, fakeApi }) => {
    await launchApp(page, baseURL!);
    await expect(page).toHaveURL(/\/welcome\/baseline$/);
    await onboarding.expectOnStep(page, "Your Baseline", 2, 5);
    expect(healthCalls(fakeApi)).toHaveLength(1);

    await onboarding.next(page);
    await expect(onboarding.incompleteBaselineAlert(page)).toBeVisible();
    expect(healthCalls(fakeApi)).toHaveLength(1);
  });

  test("an unreachable API shows the banner on the step, and Retry re-checks and clears it", async ({ page, baseURL, fakeApi }) => {
    fakeApi.override("GET /healthz", json(503, { status: "unavailable" }), { once: true });
    await launchApp(page, baseURL!);
    await onboarding.expectOnStep(page, "Your Baseline", 2, 5);
    await expect(banner(page)).toBeVisible();

    await retry(page).click();
    await expect(banner(page)).toHaveCount(0);
    expect(healthCalls(fakeApi)).toHaveLength(2);
  });
});
