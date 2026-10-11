import { describe, expect, it } from "vitest";
import { enUS } from "./en-US";

// Characterisation: the en-US wording of the sign-up, confirm, sign-in and
// signed-in screens is unchanged from the literals that were in the components
// on main before they moved into the catalog.
const expected: Record<string, string> = {
  "signUp.heading": "Sign up",
  "signUp.intro":
    "Homeowner is for the people who look after a Home together. Signing up gives you a login of your own, so your Baseline, Preferences and Restrictions are yours and follow you, whoever else lives in the Home.",
  "signUp.emailLabel": "Email",
  "signUp.emailHint":
    "Your email is your login. We also send a code to it in the next step, which proves the email is really yours.",
  "signUp.passwordLabel": "Password",
  "signUp.passwordHint": "It keeps anyone else from signing in as you.",
  "signUp.confirmLabel": "Confirm password",
  "signUp.mismatch": "The two passwords do not match.",
  "signUp.submit": "Sign up",
  "signUp.submitting": "Signing up...",
  "signUp.haveLogin": "Already signed up?",
  "signUp.haveLoginAction": "Sign in",

  "signIn.heading": "Sign in",
  "signIn.intro":
    "Signing in tells Homeowner whose Check-in and Tasks to show. You stay signed in on this device until you sign out.",
  "signIn.confirmedNotice": "Your email is confirmed. Sign in to start.",
  "signIn.emailLabel": "Email",
  "signIn.passwordLabel": "Password",
  "signIn.submit": "Sign in",
  "signIn.submitting": "Signing in...",
  "signIn.newHere": "New here?",
  "signIn.newHereAction": "Sign up",

  "confirm.heading": "Confirm your email",
  "confirm.intro":
    "We sent a code to {email}. Entering it proves the email is yours, so nobody can sign up in your name or take over your Preferences. Until you do, you cannot sign in.",
  "confirm.spamHint": "The email can take a minute, and it may land in your spam folder.",
  "confirm.codeLabel": "Code from the email",
  "confirm.submit": "Confirm",
  "confirm.submitting": "Checking...",
  "confirm.resend": "Send a new code",
  "confirm.useOtherEmail": "Use a different email",
  "confirm.resent": "A new code is on its way. Use the latest email.",

  "signedIn.heading": "You are signed in",
  "signedIn.as": "Signed in as {email}.",
  "signedIn.emailFallback": "your email",
  "signedIn.offline":
    "Homeowner cannot reach the service right now, so this is the last sign-in this device remembers. Open the app again when you are back online to check.",
  "signedIn.signOut": "Sign out",

  "auth.showPassword": "Show password",

  "auth.failure.alreadyRegistered":
    "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  "auth.failure.invalidPassword": "That password is not strong enough. {rules}",
  "auth.failure.invalidInput": "Check the email and the details you typed, then try again.",
  "auth.failure.wrongCode": "That code is not right. Check the latest email and try again.",
  "auth.failure.expiredCode": "That code has expired. Ask for a new one and use the latest email.",
  "auth.failure.notConfirmed":
    "This email has not been confirmed yet. Enter the code from your email, or ask for a new one.",
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
