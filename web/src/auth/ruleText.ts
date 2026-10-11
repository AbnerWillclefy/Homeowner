import type { MessageKey } from "../i18n";
import type { ClauseId, RuleDescription, RuleResult } from "./passwordPolicy";
import type { RuleChange } from "./ruleAnnouncement";

/** The translate function of `useI18n`, as far as this module needs it. No React here. */
export type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string;

const LABEL: Record<Exclude<RuleResult["id"], "length">, MessageKey> = {
  lowercase: "auth.rule.lowercase",
  uppercase: "auth.rule.uppercase",
  number: "auth.rule.number",
  symbol: "auth.rule.symbol",
};

const CLAUSE: Record<ClauseId, MessageKey> = {
  lowercase: "auth.rules.clause.lowercase",
  uppercase: "auth.rules.clause.uppercase",
  number: "auth.rules.clause.number",
  symbol: "auth.rules.clause.symbol",
};

/** The checklist wording of one rule, for example "At least 10 characters". */
export function ruleLabel(t: Translate, rule: RuleResult): string {
  return rule.id === "length" ? t("auth.rule.length", { count: rule.minimum ?? 0 }) : t(LABEL[rule.id]);
}

/** One checklist line: the rule and whether it is met, in words so colour never carries it alone. */
export function ruleStatus(t: Translate, rule: RuleResult): string {
  return t(rule.met ? "auth.rule.status.met" : "auth.rule.status.notMet", { rule: ruleLabel(t, rule) });
}

/**
 * The rules as one sentence. The list joins with a comma and the language's own "and" from the
 * catalog, not Intl.ListFormat: in en-US that adds a serial comma and would change the wording.
 */
export function ruleSentence(t: Translate, description: RuleDescription): string {
  const length = t("auth.rule.length", { count: description.minimumLength });
  const items = description.clauses.map((id) => t(CLAUSE[id]));
  if (items.length === 0) return t("auth.rules.lengthOnly", { length });
  const last = items[items.length - 1]!;
  const rest = items.slice(0, -1);
  const rules = rest.length === 0 ? last : t("auth.rules.listEnd", { rest: rest.join(", "), last });
  return t("auth.rules.withClauses", { length, rules });
}

/** What the live region says when the rules change; empty when there is nothing to say. */
export function announcementText(t: Translate, change: RuleChange | null): string {
  if (!change) return "";
  const parts = change.changed.map((rule) =>
    t(rule.met ? "auth.rule.announce.met" : "auth.rule.announce.notMet", { rule: ruleLabel(t, rule) }),
  );
  parts.push(t("auth.rule.announce.count", { met: change.metCount, count: change.total }));
  return parts.join(" ");
}
