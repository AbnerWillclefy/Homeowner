import { describe, expect, it } from "vitest";
import { describeRules, evaluate, parsePolicy, type PasswordPolicy } from "./passwordPolicy";

const raw = {
  minimum_length: 10,
  require_lowercase: true,
  require_uppercase: true,
  require_numbers: true,
  require_symbols: false,
};

const current: PasswordPolicy = parsePolicy(JSON.stringify(raw));
const strict: PasswordPolicy = parsePolicy(JSON.stringify({ ...raw, minimum_length: 12, require_symbols: true }));

function unmetIds(policy: PasswordPolicy, password: string): string[] {
  return evaluate(policy, password)
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);
}

describe("parsePolicy", () => {
  it("reads the Terraform output", () => {
    expect(current).toEqual({
      minimumLength: 10,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: false,
    });
  });

  it("ignores surrounding whitespace and unknown keys", () => {
    const policy = parsePolicy(`\n ${JSON.stringify({ ...raw, extra: 1 })} \n`);
    expect(policy).toEqual(current);
  });

  it.each([
    ["not JSON", "minimum_length=10"],
    ["empty", ""],
    ["null", "null"],
    ["an array", "[]"],
    ["a number", "10"],
    ["a quoted JSON string", JSON.stringify(JSON.stringify(raw))],
  ])("rejects %s, naming the setting", (_name, text) => {
    expect(() => parsePolicy(text)).toThrow(/VITE_PASSWORD_POLICY/);
  });

  it.each(Object.keys(raw))("rejects a missing %s, naming the field", (key) => {
    const copy: Record<string, unknown> = { ...raw };
    delete copy[key];
    expect(() => parsePolicy(JSON.stringify(copy))).toThrow(new RegExp(`VITE_PASSWORD_POLICY.*${key}`));
  });

  it("rejects the string \"true\" for a boolean, without coercing", () => {
    expect(() => parsePolicy(JSON.stringify({ ...raw, require_symbols: "true" }))).toThrow(/require_symbols/);
  });

  it("rejects the string \"10\" for the minimum length", () => {
    expect(() => parsePolicy(JSON.stringify({ ...raw, minimum_length: "10" }))).toThrow(/minimum_length/);
  });

  it.each([0, -1, 1.5])("rejects a minimum length of %s", (value) => {
    expect(() => parsePolicy(JSON.stringify({ ...raw, minimum_length: value }))).toThrow(/minimum_length/);
  });
});

describe("evaluate", () => {
  const good = "Abcdefgh1j";

  it("lists the active rules in order, all met for a good password", () => {
    const rules = evaluate(current, good);
    expect(rules.map((r) => r.id)).toEqual(["length", "lowercase", "uppercase", "number"]);
    expect(rules.every((r) => r.met)).toBe(true);
  });

  it("gives every entry a plain text label", () => {
    expect(evaluate(current, "").map((r) => r.label)).toEqual([
      "At least 10 characters",
      "A lower case letter",
      "An upper case letter",
      "A number",
    ]);
  });

  it("marks only length unmet one character short, and met at the minimum", () => {
    expect(unmetIds(current, "Abcdefgh1")).toEqual(["length"]);
    expect(unmetIds(current, "Abcdefgh1j")).toEqual([]);
  });

  it("marks only lowercase unmet", () => {
    expect(unmetIds(current, "ABCDEFGH12")).toEqual(["lowercase"]);
  });

  it("marks only uppercase unmet", () => {
    expect(unmetIds(current, "abcdefgh12")).toEqual(["uppercase"]);
  });

  it("marks only number unmet", () => {
    expect(unmetIds(current, "Abcdefghij")).toEqual(["number"]);
  });

  it("counts accented letters as letters", () => {
    expect(unmetIds(current, "Éécdefgh12")).toEqual([]);
  });

  it("marks everything unmet for an empty password", () => {
    expect(unmetIds(current, "")).toEqual(["length", "lowercase", "uppercase", "number"]);
  });

  it("has no symbol entry when symbols are not required", () => {
    expect(evaluate(current, "Abcdefgh1!").map((r) => r.id)).not.toContain("symbol");
  });

  it("adds a symbol entry last when symbols are required", () => {
    const rules = evaluate(strict, "Abcdefghij1!");
    expect(rules.map((r) => r.id)).toEqual(["length", "lowercase", "uppercase", "number", "symbol"]);
    expect(rules.every((r) => r.met)).toBe(true);
  });

  it("marks only symbol unmet when it is the missing rule", () => {
    expect(unmetIds(strict, "Abcdefghij12")).toEqual(["symbol"]);
  });

  it("does not count whitespace, letters or digits as a symbol", () => {
    expect(unmetIds(strict, "Abcdef ghij1")).toEqual(["symbol"]);
  });

  it("follows a different policy: minimum 12 changes the length entry", () => {
    expect(evaluate(strict, "")[0]).toEqual({ id: "length", label: "At least 12 characters", met: false });
    expect(unmetIds(strict, "Abcdefgh1!x")).toEqual(["length"]);
  });
});

describe("describeRules", () => {
  it("gives today's sentence for the current policy", () => {
    expect(describeRules(current)).toBe(
      "At least 10 characters, with an upper case letter, a lower case letter and a number.",
    );
  });

  it("adds a symbol clause only when enabled, and follows the minimum", () => {
    expect(describeRules(strict)).toBe(
      "At least 12 characters, with an upper case letter, a lower case letter, a number and a symbol.",
    );
  });

  it("drops the clauses of rules that are off", () => {
    const lax = parsePolicy(
      JSON.stringify({ ...raw, minimum_length: 8, require_lowercase: false, require_uppercase: false, require_numbers: false }),
    );
    expect(describeRules(lax)).toBe("At least 8 characters.");
  });

  it("joins two clauses with and", () => {
    const two = parsePolicy(JSON.stringify({ ...raw, require_lowercase: false, require_numbers: false }));
    expect(describeRules(two)).toBe("At least 10 characters, with an upper case letter.");
  });
});
