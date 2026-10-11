import { config } from "../config";
import type { CognitoFailure } from "./cognito";
import { describeRules } from "./passwordPolicy";

const TEXT: Record<CognitoFailure["kind"], string> = {
  "already-registered": "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  "invalid-password": `That password is not strong enough. ${describeRules(config.passwordPolicy)}`,
  "invalid-input": "Check the email and the details you typed, then try again.",
  "wrong-code": "That code is not right. Check the latest email and try again.",
  "expired-code": "That code has expired. Ask for a new one and use the latest email.",
  "not-confirmed": "This email has not been confirmed yet. Enter the code from your email, or ask for a new one.",
  "not-authorized": "The email or password is not right. Check both and try again.",
  "rate-limited": "Too many attempts. Wait a few minutes, then try again.",
  network: "Could not reach the sign-in service. Check your connection and try again.",
  error: "Something went wrong. Try again in a moment.",
};

/** Plain wording for a failed Cognito call. Never Cognito's own message. */
export function failureText(failure: CognitoFailure): string {
  return TEXT[failure.kind];
}
