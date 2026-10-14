import { describe, expect, it } from "vitest";
import { ruleChange } from "./ruleAnnouncement";
import { evaluate, parsePolicy, type PasswordPolicy } from "./passwordPolicy";

const base = {
  minimum_length: 10,
  require_lowercase: true,
  require_uppercase: true,
  require_numbers: true,
  require_symbols: false,
};
const policy = parsePolicy(JSON.stringify(base));

function change(p: PasswordPolicy, from: string, to: string) {
  return ruleChange(evaluate(p, from), evaluate(p, to), to);
}

// The words that go with a change live in ruleText.test.ts; this is only which rules changed.
describe("ruleChange", () => {
  it("is null when no rule changed", () => {
    expect(change(policy, "a", "ab")).toBeNull();
  });

  it("names a rule that became met, with the counts", () => {
    expect(change(policy, "", "a")).toEqual({
      changed: [{ id: "lowercase", met: true }],
      metCount: 1,
      total: 4,
    });
  });

  it("names a rule that became unmet again", () => {
    expect(change(policy, "aB", "B")).toEqual({
      changed: [{ id: "lowercase", met: false }],
      metCount: 1,
      total: 4,
    });
  });

  it("carries the minimum on the length rule", () => {
    expect(change(policy, "abcdefgH1", "abcdefgH12")?.changed).toEqual([{ id: "length", met: true, minimum: 10 }]);
  });

  it("is null for an empty password", () => {
    expect(change(policy, "a", "")).toBeNull();
  });

  it("never mentions symbols when the policy has no symbol rule", () => {
    const ids = change(policy, "", "abcdefghijA1!")?.changed.map((rule) => rule.id);
    expect(ids).not.toContain("symbol");
  });

  it("mentions symbols when the policy requires them", () => {
    const strict = parsePolicy(JSON.stringify({ ...base, require_symbols: true }));
    expect(change(strict, "abcdefghijA1", "abcdefghijA1!")).toEqual({
      changed: [{ id: "symbol", met: true }],
      metCount: 5,
      total: 5,
    });
  });
});
