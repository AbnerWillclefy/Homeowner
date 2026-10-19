import { describe, expect, it } from "vitest";
import { enUS } from "./en-US";

// Characterisation: the en-US wording of the sign-up, confirm, sign-in and
// signed-in screens is unchanged from the literals that were in the components
// on main before they moved into the catalog.
const expected: Record<string, string> = {
  "signUp.heading": "Sign up",
  "signUp.emailLabel": "Email",
  "signUp.passwordLabel": "Password",
  "signUp.confirmLabel": "Confirm password",
  "signUp.mismatch": "The two passwords do not match.",
  "signUp.submit": "Sign up",
  "signUp.haveLogin": "Already signed up?",
  "signUp.haveLoginAction": "Sign in",

  "signIn.heading": "Sign in",
  "signIn.confirmedNotice": "Your email is confirmed. Sign in to start.",
  "signIn.emailLabel": "Email",
  "signIn.passwordLabel": "Password",
  "signIn.submit": "Sign in",
  "signIn.newHere": "New here?",
  "signIn.newHereAction": "Sign up",

  "confirm.heading": "Confirm your email",
  "confirm.intro": "We sent a code to {email}.",
  "confirm.codeLabel": "Code from the email",
  "confirm.submit": "Confirm",
  "confirm.resend": "Send a new code",
  "confirm.useOtherEmail": "Use a different email",
  "confirm.resent": "A new code is on its way. Use the latest email.",

  "signedIn.heading": "You are signed in",
  "signedIn.as": "Signed in as {email}.",
  "signedIn.emailFallback": "your email",
  "signedIn.offline": "Cannot reach the service. This is the last sign-in this device remembers.",
  "signedIn.signOut": "Sign out",

  "auth.showPassword": "Show password",

  "auth.failure.alreadyRegistered":
    "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  "auth.failure.invalidPassword": "That password is not strong enough. Choose a different password. {rules}",
  "auth.failure.invalidInput": "Check the email and the details you typed, then try again.",
  "auth.failure.wrongCode": "That code is not right. Check the latest email and try again.",
  "auth.failure.expiredCode": "That code has expired. Request a new code and use the latest email.",
  "auth.failure.notConfirmed":
    "Confirm your email first: enter the code we sent, or request a new code.",
  "auth.failure.notAuthorized": "The email or password is not right. Check both and try again.",
  "auth.failure.rateLimited": "Too many attempts. Wait a few minutes, then try again.",
  "auth.failure.network": "Could not reach the sign-in service. Check your connection and try again.",
  "auth.failure.error": "Something went wrong. Try again in a moment.",

  "auth.rule.lowercase": "A lower case letter",
  "auth.rule.uppercase": "An upper case letter",
  "auth.rule.number": "A number",
  "auth.rule.symbol": "A symbol",
  "auth.rule.status.met": "{rule}: Met",
  "auth.rule.status.notMet": "{rule}: Not met yet",
  "auth.rule.announce.met": "{rule} met.",
  "auth.rule.announce.notMet": "{rule} not met.",
};

describe("en-US auth screen wording", () => {
  it.each(Object.entries(expected))("keeps today's literal for %s", (key, text) => {
    expect((enUS as Record<string, unknown>)[key]).toBe(text);
  });

  it("states the length rule as a plural with both forms", () => {
    expect(enUS["auth.rule.length"]).toEqual({
      one: "At least {count} character",
      other: "At least {count} characters",
    });
  });

  it("states the rules-met count as a plural on the total", () => {
    expect(enUS["auth.rule.announce.count"]).toEqual({
      one: "{met} of {count} rule met.",
      other: "{met} of {count} rules met.",
    });
  });
});
