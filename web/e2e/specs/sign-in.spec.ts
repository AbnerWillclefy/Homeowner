import { test, expect } from "../fixtures";
import { GOOD_PASSWORD, uniqueEmail } from "../mocks/users";
import { launchApp } from "../pages/launch";
import { signIn } from "../pages/signIn";
import type { Session } from "../../src/domains/auth/logic/session";

const SESSION_KEY = "homeowner.session";

// Where sign-in lands: with onboarding stored as done and no Home, the shell shows "Create your Home". Today and
// onboarding need handlers that belong to other tickets, and this one needs only the core handlers.
test.describe("with onboarding done and no Home", () => {
  test.use({ fakeState: { onboardingStored: "done" } });

  test("a known User signs in and the session is stored", async ({ page, baseURL, fakeApi, fakeCognito }, info) => {
    const email = uniqueEmail(info);
    fakeApi.state.user = { id: "user-1", email };
    fakeCognito.addUser({ email, password: GOOD_PASSWORD, confirmed: true });

    await launchApp(page, baseURL!);
    await signIn.expectVisible(page);
    await signIn.signIn(page, email, GOOD_PASSWORD);

    await expect(page.getByRole("heading", { name: "Create your Home", level: 2 })).toBeVisible();
    await expect(page).not.toHaveURL(/\/signin/);

    const raw = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
    expect(raw).not.toBeNull();
    const session = JSON.parse(raw!) as Session;
    expect(session.idToken).toBe(fakeCognito.issuedIdTokens.get(email));
    expect(session.refreshToken).not.toBe("");
    expect(session.expiresAt).toBeGreaterThan(Date.now());

    // The app used the new token for its first API call.
    expect(fakeApi.requests.some((r) => r.path === "/me" && r.authorization === `Bearer ${session.idToken}`)).toBe(true);
  });

  test("a wrong password shows the app's message and does not sign in", async ({ page, baseURL, fakeApi, fakeCognito }, info) => {
    const email = uniqueEmail(info);
    fakeCognito.addUser({ email, password: GOOD_PASSWORD, confirmed: true });

    await launchApp(page, baseURL!);
    await signIn.signIn(page, email, "Fake-Wrong-Passw0rd");

    await signIn.expectError(page, "The email or password is not right. Check both and try again.");
    await expect(page).toHaveURL(/\/signin$/);
    await signIn.expectVisible(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull();
    expect(fakeApi.requests.filter((r) => r.path !== "/healthz")).toEqual([]);
  });
});
