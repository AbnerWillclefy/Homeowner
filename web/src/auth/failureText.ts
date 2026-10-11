import type { MessageKey, Translate } from "../i18n";
import type { CognitoFailure } from "./cognito";
import { describeRules, type PasswordPolicy } from "./passwordPolicy";
import { ruleSentence } from "./ruleText";

const KEY: Record<CognitoFailure["kind"], MessageKey> = {
  "already-registered": "auth.failure.alreadyRegistered",
  "invalid-password": "auth.failure.invalidPassword",
  "invalid-input": "auth.failure.invalidInput",
  "wrong-code": "auth.failure.wrongCode",
  "expired-code": "auth.failure.expiredCode",
  "not-confirmed": "auth.failure.notConfirmed",
  "not-authorized": "auth.failure.notAuthorized",
  "rate-limited": "auth.failure.rateLimited",
  network: "auth.failure.network",
  error: "auth.failure.error",
};

/** The catalog key for a failed Cognito call. Never Cognito's own message. Pure and language-free. */
export function failureKey(failure: CognitoFailure): MessageKey {
  return KEY[failure.kind];
}

/**
 * Plain wording for a failed Cognito call in the current language. Call it at render with the
 * failure kept in state, so a language switch changes the words. A refused password carries the
 * policy's rules, which depend on the language too.
 */
export function failureMessage(t: Translate, failure: CognitoFailure, policy: PasswordPolicy): string {
  const params =
    failure.kind === "invalid-password" ? { rules: ruleSentence(t, describeRules(policy)) } : undefined;
  return t(failureKey(failure), params);
}
