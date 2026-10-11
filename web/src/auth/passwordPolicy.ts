// The password rules, as the Cognito user pool states them. Pure: it must not import config.ts.
// Client rules are guidance; Cognito stays the authority and still refuses what it dislikes.

export interface PasswordPolicy {
  minimumLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

export interface RuleResult {
  id: "length" | "lowercase" | "uppercase" | "number" | "symbol";
  /** Plain text, so it never relies on colour to carry meaning. */
  label: string;
  met: boolean;
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

interface Rule extends RuleResult {
  /** The phrase after "with" in the one-sentence text; absent for the length rule. */
  clause?: string;
  order: number;
}

function rules(policy: PasswordPolicy, password: string): Rule[] {
  const list: Rule[] = [
    {
      id: "length",
      label: `At least ${policy.minimumLength} characters`,
      met: password.length >= policy.minimumLength,
      order: 0,
    },
  ];
  if (policy.requireLowercase) {
    list.push({ id: "lowercase", label: "A lower case letter", met: /\p{Ll}/u.test(password), clause: "a lower case letter", order: 2 });
  }
  if (policy.requireUppercase) {
    list.push({ id: "uppercase", label: "An upper case letter", met: /\p{Lu}/u.test(password), clause: "an upper case letter", order: 1 });
  }
  if (policy.requireNumbers) {
    list.push({ id: "number", label: "A number", met: /[0-9]/.test(password), clause: "a number", order: 3 });
  }
  if (policy.requireSymbols) {
    // A symbol is anything that is not a letter, a digit or whitespace.
    list.push({ id: "symbol", label: "A symbol", met: /[^\p{L}0-9\s]/u.test(password), clause: "a symbol", order: 4 });
  }
  return list;
}

/** One entry per active rule: length, lowercase, uppercase, number, then symbol if required. */
export function evaluate(policy: PasswordPolicy, password: string): RuleResult[] {
  return rules(policy, password).map(({ id, label, met }) => ({ id, label, met }));
}

/** The rules as one sentence, built from the same list as `evaluate`. */
export function describeRules(policy: PasswordPolicy): string {
  const clauses = rules(policy, "")
    .filter((rule) => rule.clause)
    .sort((a, b) => a.order - b.order)
    .map((rule) => rule.clause as string);
  const head = `At least ${policy.minimumLength} characters`;
  if (clauses.length === 0) return `${head}.`;
  const joined =
    clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
  return `${head}, with ${joined}.`;
}
