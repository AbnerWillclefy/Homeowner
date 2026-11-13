// The pool's password rules, as Terraform states them. Guidance only: Cognito stays the authority.

export interface PasswordPolicy {
  minimumLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

const SETTING = "VITE_PASSWORD_POLICY";

/** Parses the Terraform `password_policy` JSON. Throws, never defaults. */
export function parsePolicy(raw: string | undefined): PasswordPolicy {
  let data: unknown;
  try {
    data = JSON.parse((raw ?? "").trim());
  } catch {
    throw new Error(`${SETTING} is not valid JSON. Expected the Terraform output cognito_password_policy.`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error(`${SETTING} must be a JSON object.`);
  const f = data as Record<string, unknown>;
  const length = f.minimum_length;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 1) {
    throw new Error(`${SETTING}: minimum_length must be a whole number of at least 1.`);
  }
  const flag = (key: string) => {
    if (typeof f[key] !== "boolean") throw new Error(`${SETTING}: ${key} must be true or false.`);
    return f[key];
  };
  return {
    minimumLength: length,
    requireLowercase: flag("require_lowercase"),
    requireUppercase: flag("require_uppercase"),
    requireNumbers: flag("require_numbers"),
    requireSymbols: flag("require_symbols"),
  };
}

export type RuleId = "length" | "lowercase" | "uppercase" | "number" | "symbol";

/** One entry per active rule, with whether the password meets it. No wording: screens choose it by `id`. */
export function evaluate(policy: PasswordPolicy, password: string): { id: RuleId; met: boolean }[] {
  const rules: { id: RuleId; met: boolean }[] = [{ id: "length", met: password.length >= policy.minimumLength }];
  if (policy.requireLowercase) rules.push({ id: "lowercase", met: /\p{Ll}/u.test(password) });
  if (policy.requireUppercase) rules.push({ id: "uppercase", met: /\p{Lu}/u.test(password) });
  if (policy.requireNumbers) rules.push({ id: "number", met: /[0-9]/.test(password) });
  if (policy.requireSymbols) rules.push({ id: "symbol", met: /[^\p{L}0-9\s]/u.test(password) });
  return rules;
}
