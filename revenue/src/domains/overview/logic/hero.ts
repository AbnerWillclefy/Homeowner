import type { CommitmentMonth } from "../api/api";
import { paceView } from "./pace";

export type Hero =
  | { kind: "invite" }
  | { kind: "none" }
  /** The current month: `cents` is the Leftover plus the planned spending, which the API's Daily allowance splits over the days left. */
  | { kind: "left"; cents: number; perDayCents: number; spentCents: number; lineEndCents: number; onPace: boolean | null }
  | { kind: "past"; spentCents: number; lineEndCents: number };

/** What the hero card shows. No Monthly income is an invitation; a past month has no Daily allowance, so it shows what was spent. */
export function heroView(m: CommitmentMonth, income: number | null, days: number): Hero {
  if (income === null) return { kind: "invite" };
  const { pace } = m;
  if (!pace) return { kind: "none" };
  const view = paceView(pace, days);
  const spentCents = view.points.at(-1)?.cents ?? 0;
  if (m.dailyAllowanceCents !== undefined && m.leftoverCents !== undefined) {
    return {
      kind: "left",
      cents: m.leftoverCents + m.plannedCents,
      perDayCents: m.dailyAllowanceCents,
      spentCents,
      lineEndCents: pace.lineEndCents,
      onPace: view.points.length === 0 ? null : !view.over,
    };
  }
  return { kind: "past", spentCents, lineEndCents: pace.lineEndCents };
}
