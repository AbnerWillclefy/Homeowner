import { test, expect } from "../fixtures";
import { CONFIRMATION_CODE } from "../mocks/cognito";
import { GOOD_PASSWORD, WEAK_PASSWORD, uniqueEmail } from "../mocks/users";
import { storedSession } from "../mocks/session";
import { confirm } from "../pages/confirm";
import { launchApp } from "../pages/launch";
import { signIn } from "../pages/signIn";
import { signUp } from "../pages/signUp";

// No session is seeded, so "/" sends the visitor to the sign-in screen, and the "Sign up" link leads on from there.
test.beforeEach(async ({ page, baseURL, fakeCognito: _ }) => {
  await launchApp(page, baseURL!);
  await signIn.expectVisible(page);
  await signIn.openSignUp(page);
  await signUp.expectVisible(page);
});

test("a new User signs up, confirms the email and is sent to sign in", async ({ page, fakeCognito }, info) => {
  const email = uniqueEmail(info);

  await signUp.fill(page, { email, password: GOOD_PASSWORD, confirm: GOOD_PASSWORD });
  await signUp.submitForm(page);
  await confirm.expectFor(page, email);

  await confirm.enterCode(page, CONFIRMATION_CODE);

  // Sign-up never signs the User in: the next screen is sign-in, with the address filled and a notice.
  await expect(page).toHaveURL(/\/signin$/);
  await signIn.expectVisible(page);
  await signIn.expectEmail(page, email);
  await signIn.expectConfirmedNotice(page);

  expect(fakeCognito.requests).toEqual([
    { action: "SignUp", username: email },
    { action: "ConfirmSignUp", username: email },
  ]);
  expect(await storedSession(page)).toBeNull();
});

// The app only shows the policy; Cognito enforces it. This proves the app words a refused password, not that it
// enforces the policy itself (the fake applies the build's policy).
test("a password that breaks the policy shows the app's message", async ({ page }, info) => {
  await signUp.fill(page, { email: uniqueEmail(info), password: WEAK_PASSWORD, confirm: WEAK_PASSWORD });
  await signUp.submitForm(page);

  await signUp.expectError(
    page,
    "That password is not strong enough. Choose a different password. At least 10 characters, with an upper case letter, a lower case letter and a number.",
  );
  await expect(page).toHaveURL(/\/signup$/);
  await signUp.expectVisible(page);
  await expect(signUp.password(page)).toHaveAttribute("aria-invalid", "true");
});

test("an email that is already registered shows the app's message", async ({ page, fakeCognito }, info) => {
  const email = uniqueEmail(info);
  fakeCognito.addUser({ email, password: GOOD_PASSWORD, confirmed: true });

  await signUp.fill(page, { email, password: GOOD_PASSWORD, confirm: GOOD_PASSWORD });
  await signUp.submitForm(page);

  await signUp.expectError(
    page,
    "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  );
  await expect(page).toHaveURL(/\/signup$/);
  await expect(signUp.email(page)).toHaveAttribute("aria-invalid", "true");
});
