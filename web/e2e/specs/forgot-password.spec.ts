import { test, expect } from "../fixtures";
import { CONFIRMATION_CODE } from "../mocks/cognito";
import { GOOD_PASSWORD, uniqueEmail } from "../mocks/users";
import { storedSession } from "../mocks/session";
import { forgotPassword } from "../pages/forgotPassword";
import { launchApp } from "../pages/launch";
import { signIn } from "../pages/signIn";

const NEW_PASSWORD = "Fake-New-Passw0rd-e2e";

test.describe("forgot password", () => {
  test.use({ fakeState: { onboardingStored: "done" } });

  test("a Resident resets the password and signs in with the new one", async ({ page, baseURL, fakeApi, fakeCognito }, info) => {
    const email = uniqueEmail(info);
    fakeApi.state.user = { id: "user-1", email };
    fakeCognito.addUser({ email, password: GOOD_PASSWORD, confirmed: true });

    await launchApp(page, baseURL!);
    await signIn.openForgotPassword(page);
    await forgotPassword.requestCode(page, email);
    await forgotPassword.expectCodeStepFor(page, email);
    await expect(forgotPassword.code(page)).toHaveValue("");

    await forgotPassword.reset(page, CONFIRMATION_CODE, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/signin$/);
    await signIn.expectPasswordChangedNotice(page);
    await signIn.expectEmail(page, email);

    await signIn.signIn(page, email, NEW_PASSWORD);
    await expect(page.getByRole("heading", { name: "Create your Home", level: 2 })).toBeVisible();
    expect(fakeCognito.requests.map((r) => r.action)).toEqual(["ForgotPassword", "ConfirmForgotPassword", "InitiateAuth"]);
  });

  test("a wrong code shows its message and changes nothing", async ({ page, baseURL, fakeCognito }, info) => {
    const email = uniqueEmail(info);
    fakeCognito.addUser({ email, password: GOOD_PASSWORD, confirmed: true });

    await launchApp(page, baseURL!);
    await signIn.openForgotPassword(page);
    await forgotPassword.requestCode(page, email);
    await forgotPassword.reset(page, "000000", NEW_PASSWORD);

    await signIn.expectError(page, "That code is not right. Check the latest email and try again.");
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(forgotPassword.code(page)).toHaveAttribute("aria-invalid", "true");
    expect(await storedSession(page)).toBeNull();
  });

  test("an email with no login reaches the same code step", async ({ page, baseURL, fakeCognito }, info) => {
    const email = uniqueEmail(info);
    // No addUser: the fake knows nobody, yet the screen must read the same.

    await launchApp(page, baseURL!);
    await signIn.openForgotPassword(page);
    await forgotPassword.requestCode(page, email);
    await forgotPassword.expectCodeStepFor(page, email);
    expect(fakeCognito.requests.map((r) => r.action)).toEqual(["ForgotPassword"]);
  });
});
