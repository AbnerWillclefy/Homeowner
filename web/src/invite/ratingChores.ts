import type { Chore } from "../chores/api";

/** "About eight": how many of the most demanding Chores a new Resident is asked to rate. */
export const RATING_CHORE_COUNT = 8;

const IMPORTANCE_RANK: Readonly<Record<string, number>> = { essential: 0, normal: 1, nice_to_have: 2 };
const UNKNOWN_RANK = 3;

function rank(importance: string): number {
  return Object.hasOwn(IMPORTANCE_RANK, importance) ? IMPORTANCE_RANK[importance]! : UNKNOWN_RANK;
}

/**
 * The Chores a new Resident rates: highest base Effort first, ties broken by Importance (essential first)
 * and then by name. Fewer Chores than the limit are all returned; none gives an empty list.
 */
export function selectChoresToRate(chores: readonly Chore[], limit: number = RATING_CHORE_COUNT): Chore[] {
  return [...chores]
    .sort(
      (a, b) =>
        b.baseEffort - a.baseEffort || rank(a.importance) - rank(b.importance) || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}
