import { formErrorId } from "../shared/ui/formErrorId";
import type { MessageKey, Translate } from "../shared/i18n";
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

export type FailureField = "email" | "password" | "code";

const FIELD: Partial<Record<CognitoFailure["kind"], FailureField>> = {
  "already-registered": "email",
  "invalid-input": "email",
  "invalid-password": "password",
  "wrong-code": "code",
  "expired-code": "code",
};

/** The field a failure is about, or null when it belongs to the whole form. Lets a screen link the field to the message. */
export function failureField(failure: CognitoFailure): FailureField | null {
  return FIELD[failure.kind] ?? null;
}

/**
 * The accessibility attributes for one input: invalid and pointing at the form's error when the failure is
 * about this field. `baseIds` are the field's own hints, kept ahead of the error in `aria-describedby`.
 */
export function fieldError(
  problem: CognitoFailure | null,
  field: FailureField,
  form: string,
  baseIds?: string,
): { "aria-invalid": true | undefined; "aria-describedby": string | undefined } {
  const about = problem !== null && failureField(problem) === field;
  const ids = [baseIds, about ? formErrorId(form) : undefined].filter(Boolean).join(" ");
  return { "aria-invalid": about || undefined, "aria-describedby": ids || undefined };
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
