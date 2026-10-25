import { apiBaseUrl, cognitoRegion } from "../env";
import { test, expect } from "../fixtures";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { residentsHandlers } from "../mocks/handlers/residents";
import { todayHandlers } from "../mocks/handlers/today";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

test.describe("seeded session", () => {
  test.use({ fakeState: { onboardingStored: "done" } });

  test("opens signed in, sends the bearer token and survives a reload", async ({ page, baseURL, fakeApi }) => {
    // Launching on Today starts its reads at once, even with no Home to show (ADR 0016).
    fakeApi.use(onboardingHandlers);
    fakeApi.use(todayHandlers);
    fakeApi.use(residentsHandlers);
    await seedSession(page);
    await launchApp(page, baseURL!);

    // Level 2 is the form heading; the app title above it is the only level 1.
    await expect(page.getByRole("heading", { name: "Create your Home", level: 2 })).toBeVisible();
    expect(fakeApi.requests.some((r) => r.path === "/me" && r.authorization?.startsWith("Bearer "))).toBe(true);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Create your Home", level: 2 })).toBeVisible();
  });
});

// The fixture's end-of-test check is what turns a missed route into a failure; test.fail passes only if it fires.
test("a test that leaves an unmocked request behind fails", async ({ page, baseURL }) => {
  test.fail();
  await launchApp(page, baseURL!);
  await page.evaluate(() => fetch("https://unmocked.e2e.test/left-behind").catch(() => null));
});

test("a request nothing covers is reported as unmocked", async ({ page, baseURL, router }) => {
  await launchApp(page, baseURL!);

  const results = await page.evaluate(async (apiBase) => {
    const attempt = (url: string) =>
      fetch(url).then(
        (response) => response.status,
        () => "failed",
      );
    // A path the fake has no handler for (answered 501), then a host no fake owns (aborted).
    return [await attempt(`${apiBase}/not-a-route`), await attempt("https://unmocked.e2e.test/anything")];
  }, apiBaseUrl);

  expect(results).toEqual([501, "failed"]);
  // Taking the list clears it, so the fixture's end-of-test check passes.
  expect(router.takeUnmocked()).toEqual([
    { method: "GET", url: `${apiBaseUrl}/not-a-route` },
    { method: "GET", url: "https://unmocked.e2e.test/anything" },
  ]);
});

test("a Cognito action the fake does not support is reported as unmocked", async ({ page, baseURL, router, fakeCognito }) => {
  await launchApp(page, baseURL!);

  const status = await page.evaluate(async (region) => {
    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.GlobalSignOut" },
      body: JSON.stringify({ ClientId: "anything" }),
    });
    return response.status;
  }, cognitoRegion);

  expect(status).toBe(501);
  expect(fakeCognito.requests).toEqual([]);
  expect(router.takeUnmocked()).toEqual([{ method: "POST", url: `https://cognito-idp.${cognitoRegion}.amazonaws.com/` }]);
});
