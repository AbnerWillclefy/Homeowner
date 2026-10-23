import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import type { FakeApi } from "../mocks/api";
import { hold } from "../mocks/hold";
import { homeHandlers } from "../mocks/handlers/home";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { FAKE_VAPID_KEY, pushHandlers } from "../mocks/handlers/push";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the launch re-subscribe to push reminders on a device that already granted permission and has
// a subscription. It starts only after the first page load has settled (Today's content is on screen), or after
// the fallback delay (5 s) when the page never reports one (onboarding). Without permission it sends nothing and
// shows nothing new. Enabling from a button is covered by the unit tests; it never waits.

/**
 * Gives the page a push subscription made with the fake VAPID key, and the notification permission it should
 * report. The permission is faked in the page because headless Chromium reports "denied" even after a grant.
 */
async function withExistingSubscription(page: Page, permission: NotificationPermission) {
  await page.addInitScript(({ key, permission }) => {
    const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const subscription = {
      endpoint: "https://push.example.test/e2e",
      options: { applicationServerKey: bytes.buffer },
      toJSON: () => ({ endpoint: "https://push.example.test/e2e", keys: { p256dh: "p256dh", auth: "auth" } }),
      unsubscribe: async () => true,
    };
    const registration = { pushManager: { getSubscription: async () => subscription, subscribe: async () => subscription } };
    Object.defineProperty(Notification, "permission", { get: () => permission, configurable: true });
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(registration), configurable: true });
  }, { key: FAKE_VAPID_KEY, permission });
}

const indexOf = (api: FakeApi, method: string, path: string) =>
  api.requests.findIndex((request) => request.method === method && request.path === path);
const pushRequests = (api: FakeApi) => api.requests.filter((request) => request.path.startsWith("/push/"));

test.describe("permission granted, subscription exists", () => {
  test.beforeEach(async ({ page, fakeApi }) => {
    await withExistingSubscription(page, "granted");
    fakeApi.use(pushHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  test.describe("on Today", () => {
    test.use({ fakeState: signedInResident() });

    test("starts after Today's first load settles, not before", async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      const dayPlan = hold(page, /\/home\/day-plan$/);
      await launchApp(page, baseURL!);

      // The held read has not reached the fake, so Today has not settled: the page is up and nothing push-related ran.
      await expect.poll(() => indexOf(fakeApi, "GET", "/home/check-in")).toBeGreaterThanOrEqual(0);
      await page.waitForTimeout(1000);
      expect(indexOf(fakeApi, "GET", "/home/day-plan")).toBe(-1);
      await expect(page.getByText("Wash the dishes", { exact: true })).toHaveCount(0);
      expect(pushRequests(fakeApi)).toEqual([]);

      dayPlan.release();
      await expect(page.getByText("Wash the dishes", { exact: true })).toBeVisible();
      await expect.poll(() => indexOf(fakeApi, "PUT", "/push/subscription")).toBeGreaterThanOrEqual(0);

      const planRead = indexOf(fakeApi, "GET", "/home/day-plan");
      expect(indexOf(fakeApi, "GET", "/push/vapid-public-key")).toBeGreaterThan(planRead);
      expect(indexOf(fakeApi, "PUT", "/push/subscription")).toBeGreaterThan(indexOf(fakeApi, "GET", "/push/vapid-public-key"));
    });
  });

  test.describe("mid-onboarding", () => {
    test("runs after the fallback delay when no page reports a first load", async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(onboardingHandlers);
      fakeApi.use(homeHandlers);
      const started = Date.now();
      await launchApp(page, baseURL!);
      await expect(page).toHaveURL(/\/welcome\/reminders$/);

      await page.waitForTimeout(2000);
      expect(pushRequests(fakeApi)).toEqual([]);

      await expect.poll(() => indexOf(fakeApi, "PUT", "/push/subscription"), { timeout: 10_000 }).toBeGreaterThanOrEqual(0);
      expect(Date.now() - started).toBeGreaterThanOrEqual(4500);
    });
  });
});

test.describe("permission not granted", () => {
  test.use({ fakeState: signedInResident() });

  test("sends no push request and shows nothing about reminders", async ({ page, baseURL, fakeApi }) => {
    await withExistingSubscription(page, "default");
    fakeApi.use(pushHandlers);
    fakeApi.use(signedInHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
    await launchApp(page, baseURL!);

    await expect(page.getByText("Wash the dishes", { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(pushRequests(fakeApi)).toEqual([]);
    await expect(page.getByText(/reminder|lembrete|notification|notifica/i)).toHaveCount(0);
  });
});
