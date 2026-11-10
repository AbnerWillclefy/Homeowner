import type { OverLimit, Savings } from "../api/api";
import type { Translate } from "../../../shared/i18n/context";
import { monthLabel, type Month } from "./month";

/** How much of the target is saved, rounded down and kept within 0..100 for a bar; the text beside it shows the real amounts. */
export const progressPercent = (savedCents: number, targetCents: number): number =>
  targetCents <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((savedCents * 100) / targetCents)));

const index = (month: Month) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return y * 12 + m;
};

/** Whole months from `from` to `to` (both `YYYY-MM`). */
export const monthsAfter = (from: Month, to: Month): number => index(to) - index(from);

/** What to say about when a Goal or the reserve is reached. */
export type When =
  | { kind: "none" }
  | { kind: "reached" }
  /** Not reached within the horizon (10 years): said in words, never a blank date. */
  | { kind: "beyond" }
  | { kind: "expected"; month: Month }
  | { kind: "late"; month: Month; monthsLate: number };

export function whenOf(p: {
  savedCents: number;
  targetCents: number;
  monthCents: number | null;
  expectedMonth: Month | null;
  late?: boolean;
  targetMonth?: Month | null;
}): When {
  if (p.savedCents >= p.targetCents) return { kind: "reached" };
  if (p.monthCents === null) return { kind: "none" };
  if (p.expectedMonth === null) return { kind: "beyond" };
  if (p.late && p.targetMonth) return { kind: "late", month: p.expectedMonth, monthsLate: monthsAfter(p.targetMonth, p.expectedMonth) };
  return { kind: "expected", month: p.expectedMonth };
}

/** When, in words ("Prevista para abril de 2029"); null when there is nothing to say. */
export function whenText(t: Translate, locale: string, when: When, who: "reserve" | "goal"): string | null {
  switch (when.kind) {
    case "none":
      return null;
    case "reached":
      return t("finances.savings.reached");
    case "beyond":
      return t("finances.savings.beyond");
    case "late":
      return t("finances.savings.late", { month: monthLabel(when.month, locale), count: when.monthsLate });
    case "expected":
      return t(who === "reserve" ? "finances.savings.expectedReserve" : "finances.savings.expectedGoal", { month: monthLabel(when.month, locale) });
  }
}

export type SuggestionRow =
  | { kind: "reserve"; cents: number; when: When }
  /** No reserve target: the whole contribution goes to the Goals. */
  | { kind: "noTarget" }
  /** `cents` is null for a Goal already full: it takes nothing. */
  | { kind: "goal"; id: string; name: string; cents: number | null; when: When }
  | { kind: "unassigned"; cents: number };

/** How this month's leftover compares with the Monthly contribution. */
export type MonthPart =
  /** `reaches` is what comes sooner: the reserve while it is unfilled, else the first Goal. */
  | { kind: "above"; leftoverCents: number; extraCents: number; monthsSooner: number | null; reaches: "reserve" | "goal" }
  | { kind: "below"; leftoverCents: number | null; shortfallCents: number | null; over: OverLimit[] }
  | { kind: "noIncome" }
  /** The leftover equals the contribution, or the income is not known yet. */
  | { kind: "none" };

export type Suggestion = { kind: "noContribution" } | { kind: "ready"; baseCents: number; rows: SuggestionRow[]; month: MonthPart };

/**
 * The state of the month's suggestion card. `incomeSet` and `leftoverCents` come from Commitments (null while it
 * has not loaded): the savings read has no leftover when there is no income, and does not repeat it below the contribution.
 */
export function suggestionOf(s: Savings, ctx: { incomeSet: boolean | null; leftoverCents: number | null }): Suggestion {
  const base = s.contributionBaseCents;
  if (base === null) return { kind: "noContribution" };
  const r = s.reserve;
  const rows: SuggestionRow[] = [
    r.targetCents === null
      ? { kind: "noTarget" }
      : { kind: "reserve", cents: r.monthCents ?? 0, when: whenOf({ ...r, targetCents: r.targetCents }) },
    ...s.goals.map((g): SuggestionRow => {
      const when = whenOf(g);
      return { kind: "goal", id: g.id, name: g.name, cents: when.kind === "reached" ? null : g.monthCents, when };
    }),
    ...(s.unassignedCents > 0 ? [{ kind: "unassigned", cents: s.unassignedCents } as const] : []),
  ];
  return { kind: "ready", baseCents: base, rows, month: monthPart(s, base, rows, ctx) };
}

function monthPart(s: Savings, base: number, rows: SuggestionRow[], ctx: { incomeSet: boolean | null; leftoverCents: number | null }): MonthPart {
  if (ctx.incomeSet === false) return { kind: "noIncome" };
  if (s.leftover) {
    const { leftoverCents, extraCents, monthsSooner } = s.leftover;
    const reaches = rows.some((r) => r.kind === "reserve" && r.when.kind !== "reached") ? "reserve" : "goal";
    return { kind: "above", leftoverCents, extraCents, monthsSooner: monthsSooner !== null && monthsSooner > 0 ? monthsSooner : null, reaches };
  }
  if (s.overLimit)
    return { kind: "below", leftoverCents: ctx.leftoverCents, shortfallCents: ctx.leftoverCents === null ? null : base - ctx.leftoverCents, over: s.overLimit };
  return { kind: "none" };
}
