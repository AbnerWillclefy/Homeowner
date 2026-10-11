import type { RuleResult } from "./passwordPolicy";

export interface RuleChange {
  /** The rules whose state differs from before, in checklist order. */
  changed: RuleResult[];
  metCount: number;
  total: number;
}

/**
 * What changed between the rules as last announced (`before`) and now (`after`), for the screen
 * reader live region. Null when nothing changed or the password is empty, so the region stays
 * quiet. Data only: `ruleText.announcementText` turns it into words in the current language.
 */
export function ruleChange(before: RuleResult[], after: RuleResult[], password: string): RuleChange | null {
  if (password === "") return null;
  const wasMet = new Map(before.map((rule) => [rule.id, rule.met]));
  const changed = after.filter((rule) => (wasMet.get(rule.id) ?? false) !== rule.met);
  if (changed.length === 0) return null;
  return { changed, metCount: after.filter((rule) => rule.met).length, total: after.length };
}
