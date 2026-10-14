import type { MessageKey, Translate } from "../../../shared/i18n";

/** The five named Effort levels, lightest first. Underneath they are the points 1 to 5, which is all the API knows. */
export const EFFORT_LEVELS = ["very_light", "light", "medium", "heavy", "very_heavy"] as const;

export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** The level for an Effort in points; null for anything outside 1 to 5, so the API's field error can still show. */
export function effortToLevel(effort: number): EffortLevel | null {
  return Number.isInteger(effort) ? (EFFORT_LEVELS[effort - 1] ?? null) : null;
}

export function levelToEffort(level: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(level) + 1;
}

/** The label key of a level. */
export function effortLevelKey(level: EffortLevel): MessageKey {
  return `effort.level.${level}`;
}

/** The words for an Effort in points. An Effort the API would refuse falls back to its number rather than hiding it. */
export function effortName(t: Translate, effort: number): string {
  const level = effortToLevel(effort);
  return level ? t(effortLevelKey(level)) : String(effort);
}
