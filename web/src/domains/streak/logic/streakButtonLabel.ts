import type { Translate } from "../../../shared/i18n/context";

/**
 * The accessible name of the Streak button, with the value in it ("Streak: 3 days"). A Streak of 0 has its own key:
 * pt-BR's plural rule files 0 under "one", which would say "0 dia".
 */
export function streakButtonLabel(t: Translate, current: number): string {
  return t(current === 0 ? "streak.button.zero" : "streak.button", { count: current });
}
