import { describe, expect, it } from "vitest";
import { enUS } from "../shared/i18n/catalogs/en-US";
import { ptBR } from "../shared/i18n/catalogs/pt-BR";
import type { Locale } from "../shared/i18n/locales";
import { createTranslate } from "../shared/i18n/translate";
import { describeRules, evaluate, parsePolicy, type PasswordPolicy } from "./passwordPolicy";
import { announcementText, ruleLabel, ruleSentence, ruleStatus } from "./ruleText";
import { ruleChange } from "./ruleAnnouncement";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR });
const inLocale = (locale: Locale) => (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate(locale, key, params);
const en = inLocale("en-US");
const pt = inLocale("pt-BR");

const raw = {
  minimum_length: 10,
  require_lowercase: true,
  require_uppercase: true,
  require_numbers: true,
  require_symbols: false,
};
const current: PasswordPolicy = parsePolicy(JSON.stringify(raw));
const strict: PasswordPolicy = parsePolicy(JSON.stringify({ ...raw, minimum_length: 12, require_symbols: true }));
const lax: PasswordPolicy = parsePolicy(
  JSON.stringify({ ...raw, minimum_length: 8, require_lowercase: false, require_uppercase: false, require_numbers: false }),
);

describe("ruleSentence", () => {
  it("is exactly the legacy en-US sentence for the current policy", () => {
    expect(ruleSentence(en, describeRules(current))).toBe(
      "At least 10 characters, with an upper case letter, a lower case letter and a number.",
    );
  });

  it("has no serial comma, which Intl.ListFormat would add in en-US", () => {
    const listFormat = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });
    expect(listFormat.format(["a", "b", "c"])).toBe("a, b, and c");
    expect(ruleSentence(en, describeRules(current))).not.toContain(", and ");
  });

  it("adds a symbol clause and follows the minimum", () => {
    expect(ruleSentence(en, describeRules(strict))).toBe(
      "At least 12 characters, with an upper case letter, a lower case letter, a number and a symbol.",
    );
  });

  it("is only the length when no other rule is on", () => {
    expect(ruleSentence(en, describeRules(lax))).toBe("At least 8 characters.");
  });

  it("joins two clauses with and, and leaves one alone", () => {
    const two = parsePolicy(JSON.stringify({ ...raw, require_lowercase: false }));
    expect(ruleSentence(en, describeRules(two))).toBe(
      "At least 10 characters, with an upper case letter and a number.",
    );
    const one = parsePolicy(JSON.stringify({ ...raw, require_lowercase: false, require_numbers: false }));
    expect(ruleSentence(en, describeRules(one))).toBe("At least 10 characters, with an upper case letter.");
  });

  it("uses e as the pt-BR conjunction", () => {
    expect(ruleSentence(pt, describeRules(current))).toBe(
      "Pelo menos 10 caracteres, com uma letra maiúscula, uma letra minúscula e um número.",
    );
    expect(ruleSentence(pt, describeRules(strict))).toBe(
      "Pelo menos 12 caracteres, com uma letra maiúscula, uma letra minúscula, um número e um símbolo.",
    );
  });
});

describe("ruleLabel", () => {
  it("gives the checklist wording of today in en-US", () => {
    expect(evaluate(current, "").map((rule) => ruleLabel(en, rule))).toEqual([
      "At least 10 characters",
      "A lower case letter",
      "An upper case letter",
      "A number",
    ]);
  });

  it("translates the checklist to pt-BR", () => {
    expect(evaluate(strict, "").map((rule) => ruleLabel(pt, rule))).toEqual([
      "Pelo menos 12 caracteres",
      "Uma letra minúscula",
      "Uma letra maiúscula",
      "Um número",
      "Um símbolo",
    ]);
  });

  it.each([
    ["en-US", en, "At least 1 character", "At least 10 characters"],
    ["pt-BR", pt, "Pelo menos 1 caractere", "Pelo menos 10 caracteres"],
  ] as const)("uses the singular length rule at 1 and the plural at 10 in %s", (_name, t, one, many) => {
    expect(ruleLabel(t, { id: "length", met: false, minimum: 1 })).toBe(one);
    expect(ruleLabel(t, { id: "length", met: false, minimum: 10 })).toBe(many);
  });
});

describe("ruleStatus", () => {
  it("says met or not met in words, never by colour alone", () => {
    const [length] = evaluate(current, "");
    expect(ruleStatus(en, { ...length!, met: true })).toBe("At least 10 characters: Met");
    expect(ruleStatus(en, { ...length!, met: false })).toBe("At least 10 characters: Not met yet");
    expect(ruleStatus(pt, { ...length!, met: true })).toBe("Pelo menos 10 caracteres: cumprida");
  });
});

describe("announcementText", () => {
  function announce(t: typeof en, policy: PasswordPolicy, from: string, to: string) {
    return announcementText(t, ruleChange(evaluate(policy, from), evaluate(policy, to), to));
  }

  it("says nothing when nothing changed", () => {
    expect(announce(en, current, "a", "ab")).toBe("");
  });

  it("names a rule that became met, with the count", () => {
    expect(announce(en, current, "", "a")).toBe("A lower case letter met. 1 of 4 rules met.");
  });

  it("announces a rule that became unmet again", () => {
    expect(announce(en, current, "aB", "B")).toBe("A lower case letter not met. 1 of 4 rules met.");
  });

  it("reports all rules met", () => {
    expect(announce(en, current, "abcdefgH1", "abcdefgH12")).toBe("At least 10 characters met. 4 of 4 rules met.");
  });

  it("mentions symbols when the policy requires them", () => {
    expect(announce(en, strict, "abcdefghijA1", "abcdefghijA1!")).toBe("A symbol met. 5 of 5 rules met.");
  });

  it("speaks pt-BR", () => {
    expect(announce(pt, current, "", "a")).toBe("Uma letra minúscula cumprida. 1 de 4 regras cumpridas.");
  });

  it("uses the singular count wording for one rule in total", () => {
    const only = parsePolicy(
      JSON.stringify({ ...raw, minimum_length: 1, require_lowercase: false, require_uppercase: false, require_numbers: false }),
    );
    expect(announce(en, only, "", "a")).toBe("At least 1 character met. 1 of 1 rule met.");
  });
});
