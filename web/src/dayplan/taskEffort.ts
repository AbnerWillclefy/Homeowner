import type { Translate } from "../i18n";
import { effortName } from "../chores/effortLevels";

/** The Effort line of a Task: its current level, and the base level too once it has grown above it. */
export function taskEffortText(t: Translate, currentEffort: number, baseEffort: number): string {
  const level = effortName(t, currentEffort);
  return currentEffort === baseEffort
    ? t("dayplan.task.effort", { level })
    : t("dayplan.task.effort.grown", { level, base: effortName(t, baseEffort) });
}
