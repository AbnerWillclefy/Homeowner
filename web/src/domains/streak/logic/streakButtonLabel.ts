import type { Translate } from "../../../shared/i18n/context";

/**
 * The accessible name of the Streak button, with the value in it ("Streak: 3 days"). A Streak of 0 has its own key:
 * pt-BR's plural rule files 0 under "one", which would say "0 dia". On a Drained day the Streak pauses and the name
 * says so ("Streak paused: 3 days"), since the pause icon alone is not a name; a Streak of 0 has nothing to pause.
 */
export function streakButtonLabel(t: Translate, current: number, paused = false): string {
  if (current === 0) return t("streak.button.zero");
  return t(paused ? "streak.button.paused" : "streak.button", { count: current });
}
