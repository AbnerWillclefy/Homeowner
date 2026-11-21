import type { CommitmentMonth } from "../../overview/api/api";
import type { SavingsGoal } from "../../goals/api";
import type { SourcesStatus } from "../../sources/api";

/** What the Goals have saved of what they target, as a ratio; null with no Goal or no target. The reserve is not a Goal. */
export function goalsProgress(goals: Pick<SavingsGoal, "savedCents" | "targetCents">[]): number | null {
  const target = goals.reduce((sum, g) => sum + g.targetCents, 0);
  return target > 0 ? goals.reduce((sum, g) => sum + g.savedCents, 0) / target : null;
}

/** The first of the months whose Leftover is negative: where the Projection runs short. */
export function firstShortMonth(months: Pick<CommitmentMonth, "month" | "leftoverCents">[]): { month: string; cents: number } | null {
  for (const m of months) if (m.leftoverCents !== undefined && m.leftoverCents < 0) return { month: m.month, cents: m.leftoverCents };
  return null;
}

/** The first bank that asks to be connected again: its name, or null inside when the API gave none. Null outside when none does. */
export function firstReconnect(items: SourcesStatus["items"]): { bankName: string | null } | null {
  const item = items.find((i) => i.status === "reconnect");
  return item ? { bankName: item.bankName } : null;
}
