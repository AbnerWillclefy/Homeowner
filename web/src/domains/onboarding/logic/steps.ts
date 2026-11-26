import type { OnboardingPosition } from "../api/api";
import { stepPath } from "../../../app/logic/routes";
import { ONBOARDING_SCREENS, screenOf, type OnboardingScreen } from "./screens";

/**
 * The screens this User walks, in order. A joiner (the first answer of `GET /me/onboarding` was not `home`, so
 * the Home came with the Invite) never sees the Home screen. Decided once, at the first answer: asking "does a Home
 * exist now" would turn the creator's "de 5" into "de 4" the moment they create it.
 */
export function stepsFor(joiner: boolean): readonly OnboardingScreen[] {
  return joiner ? ONBOARDING_SCREENS.filter((screen) => screen !== "home") : ONBOARDING_SCREENS;
}

const order = (position: OnboardingPosition) =>
  position === "done" ? ONBOARDING_SCREENS.length : ONBOARDING_SCREENS.indexOf(screenOf(position));

/** The screen to show for a stored step: `install` and `reminders` are both the last screen; `home` is skipped for a joiner. */
export function effectiveStep(steps: readonly OnboardingScreen[], step: OnboardingPosition): OnboardingScreen | "done" {
  return steps.find((s) => ONBOARDING_SCREENS.indexOf(s) >= order(step)) ?? "done";
}

export function nextStep(steps: readonly OnboardingScreen[], step: OnboardingScreen): OnboardingScreen | "done" {
  return steps[steps.indexOf(step) + 1] ?? "done";
}

/**
 * Going back is only local; it never lowers what the server has stored. It never returns to `home`: once the
 * Home exists, CreateHome there would try to make a second one (409). A joiner has no `home` screen to skip to.
 */
export function previousStep(steps: readonly OnboardingScreen[], step: OnboardingScreen): OnboardingScreen | null {
  const previous = steps[steps.indexOf(step) - 1] ?? null;
  return previous === "home" ? null : previous;
}

/**
 * What to show after the server accepted `current` as finished. One screen on from it, not the stored step, so
 * a User who went back walks forward through the screens they revisit. Only `done` is taken from the server.
 */
export function stepAfter(
  steps: readonly OnboardingScreen[],
  current: OnboardingScreen,
  stored: OnboardingPosition,
): OnboardingScreen | "done" {
  return stored === "done" ? "done" : nextStep(steps, current);
}

/**
 * The path to go to once the server accepted `current`: the next screen's, or null when the walk is over (the
 * guard then sends the User to Today).
 */
export function pathAfterAdvance(
  steps: readonly OnboardingScreen[],
  current: OnboardingScreen,
  stored: OnboardingPosition,
): string | null {
  const after = stepAfter(steps, current, stored);
  return after === "done" ? null : stepPath(after);
}

/** "Step n of m" over the screens this User walks. */
export function progress(steps: readonly OnboardingScreen[], current: OnboardingScreen): { step: number; total: number } {
  return { step: steps.indexOf(current) + 1, total: steps.length };
}
