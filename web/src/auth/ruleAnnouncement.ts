import type { RuleResult } from "./passwordPolicy";

/**
 * What a screen reader should hear when the evaluated rules change from `before` to `after`.
 * Only the rules that changed are named, plus the count. Empty when nothing changed or the
 * password is empty, so the live region stays quiet.
 */
export function announceRuleChange(before: RuleResult[], after: RuleResult[], password: string): string {
  if (password === "") return "";
  const wasMet = new Map(before.map((rule) => [rule.id, rule.met]));
  const changed = after.filter((rule) => (wasMet.get(rule.id) ?? false) !== rule.met);
  if (changed.length === 0) return "";

  const parts = changed.map((rule) => `${rule.label} ${rule.met ? "met" : "not met"}.`);
  const count = after.filter((rule) => rule.met).length;
  return `${parts.join(" ")} ${count} of ${after.length} rules met.`;
}
