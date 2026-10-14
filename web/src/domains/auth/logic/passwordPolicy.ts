// The password rules, as the Cognito user pool states them. Pure: it must not import config.ts.
// Client rules are guidance; Cognito stays the authority and still refuses what it dislikes.

export interface PasswordPolicy {
  minimumLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

export type RuleId = "length" | "lowercase" | "uppercase" | "number" | "symbol";

/** A rule and whether a password meets it. No wording: the screens choose the words by `id`. */
export interface RuleResult {
  id: RuleId;
  met: boolean;
  /** The minimum length, on the length rule only. */
  minimum?: number;
}

/** The rules a sentence lists after the length. */
export type ClauseId = Exclude<RuleId, "length">;

export interface RuleDescription {
  minimumLength: number;
  /** In the order the sentence gives them. */
  clauses: ClauseId[];
}

const SETTING = "VITE_PASSWORD_POLICY";

const BOOLEAN_FIELDS = [
  ["require_lowercase", "requireLowercase"],
  ["require_uppercase", "requireUppercase"],
  ["require_numbers", "requireNumbers"],
  ["require_symbols", "requireSymbols"],
] as const;

/** Parses the Terraform `password_policy` JSON. Throws, never defaults. */
export function parsePolicy(raw: string): PasswordPolicy {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    throw new Error(`${SETTING} is not valid JSON. Expected the Terraform output password_policy.`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${SETTING} must be a JSON object.`);
  }
  const fields = data as Record<string, unknown>;

  const length = fields.minimum_length;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 1) {
    throw new Error(`${SETTING}: minimum_length must be a whole number of at least 1.`);
  }

  const flags: Record<string, boolean> = {};
  for (const [key, name] of BOOLEAN_FIELDS) {
    const value = fields[key];
    if (typeof value !== "boolean") throw new Error(`${SETTING}: ${key} must be true or false.`);
    flags[name] = value;
  }

  return {
    minimumLength: length,
    requireLowercase: flags.requireLowercase,
    requireUppercase: flags.requireUppercase,
    requireNumbers: flags.requireNumbers,
    requireSymbols: flags.requireSymbols,
  };
}

/** The order the one-sentence text lists the rules after the length. */
const CLAUSE_ORDER: ClauseId[] = ["uppercase", "lowercase", "number", "symbol"];

function rules(policy: PasswordPolicy, password: string): RuleResult[] {
  const list: RuleResult[] = [{ id: "length", met: password.length >= policy.minimumLength, minimum: policy.minimumLength }];
  if (policy.requireLowercase) list.push({ id: "lowercase", met: /\p{Ll}/u.test(password) });
  if (policy.requireUppercase) list.push({ id: "uppercase", met: /\p{Lu}/u.test(password) });
  if (policy.requireNumbers) list.push({ id: "number", met: /[0-9]/.test(password) });
  // A symbol is anything that is not a letter, a digit or whitespace.
  if (policy.requireSymbols) list.push({ id: "symbol", met: /[^\p{L}0-9\s]/u.test(password) });
  return list;
}

/** One entry per active rule: length, lowercase, uppercase, number, then symbol if required. */
export function evaluate(policy: PasswordPolicy, password: string): RuleResult[] {
  return rules(policy, password);
}

/** The rules as data for the one-sentence text, built from the same list as `evaluate`. */
export function describeRules(policy: PasswordPolicy): RuleDescription {
  const active = new Set(rules(policy, "").map((rule) => rule.id));
  return { minimumLength: policy.minimumLength, clauses: CLAUSE_ORDER.filter((id) => active.has(id)) };
}
