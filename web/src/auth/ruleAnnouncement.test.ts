import { describe, expect, it } from "vitest";
import { announceRuleChange } from "./ruleAnnouncement";
import { evaluate, parsePolicy, type PasswordPolicy } from "./passwordPolicy";

const base = {
  minimum_length: 10,
  require_lowercase: true,
  require_uppercase: true,
  require_numbers: true,
  require_symbols: false,
};
const policy = parsePolicy(JSON.stringify(base));

function announce(p: PasswordPolicy, from: string, to: string) {
  return announceRuleChange(evaluate(p, from), evaluate(p, to), to);
}

describe("announceRuleChange", () => {
  it("says nothing when no rule changed", () => {
    expect(announce(policy, "a", "ab")).toBe("");
  });

  it("names a rule that became met, with the count", () => {
    expect(announce(policy, "", "a")).toBe("A lower case letter met. 1 of 4 rules met.");
  });

  it("announces a rule that became unmet again", () => {
    expect(announce(policy, "aB", "B")).toBe("A lower case letter not met. 1 of 4 rules met.");
  });

  it("reports all rules met", () => {
    expect(announce(policy, "abcdefgH1", "abcdefgH12")).toBe("At least 10 characters met. 4 of 4 rules met.");
  });

  it("says nothing for an empty password", () => {
    expect(announce(policy, "a", "")).toBe("");
  });

  it("never mentions symbols when the policy has no symbol rule", () => {
    expect(announce(policy, "", "abcdefghijA1!").toLowerCase()).not.toContain("symbol");
  });

  it("mentions symbols when the policy requires them", () => {
    const strict = parsePolicy(JSON.stringify({ ...base, require_symbols: true }));
    expect(announce(strict, "abcdefghijA1", "abcdefghijA1!")).toBe("A symbol met. 5 of 5 rules met.");
  });
});
