import { ONBOARDING_STEPS, type OnboardingPosition, type OnboardingStep } from "./api";
import { stepPath } from "../app/routes";
import type { ReminderAvailability } from "../push/platform";

/** The steps that apply on this device, in order. Installing only applies to iOS in a browser tab. */
export function stepsFor(availability: ReminderAvailability): readonly OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => step !== "install" || availability.kind === "needs-install");
}

const order = (step: OnboardingPosition) => (step === "done" ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(step));

/** The step to show for a stored one: itself, or the next that applies here (install is skipped off iOS). */
export function effectiveStep(steps: readonly OnboardingStep[], step: OnboardingPosition): OnboardingPosition {
  return steps.find((s) => order(s) >= order(step)) ?? "done";
}

export function nextStep(steps: readonly OnboardingStep[], step: OnboardingStep): OnboardingPosition {
  return steps[steps.indexOf(step) + 1] ?? "done";
}

/** Going back is only local; it never lowers what the server has stored. */
export function previousStep(steps: readonly OnboardingStep[], step: OnboardingStep): OnboardingStep | null {
  return steps[steps.indexOf(step) - 1] ?? null;
}

/**
 * What to show after the server accepted `current` as finished. One step on from it, not the stored step, so
 * a User who went back walks forward through the steps they revisit. Only `done` is taken from the server.
 */
export function stepAfter(
  steps: readonly OnboardingStep[],
  current: OnboardingStep,
  stored: OnboardingPosition,
): OnboardingPosition {
  return stored === "done" ? "done" : nextStep(steps, current);
}

/**
 * The path to go to once the server accepted `current`: the next step's, or null when the walk is over (the
 * guard then sends the User to Today).
 */
export function pathAfterAdvance(
  steps: readonly OnboardingStep[],
  current: OnboardingStep,
  stored: OnboardingPosition,
): string | null {
  const after = stepAfter(steps, current, stored);
  return after === "done" ? null : stepPath(after);
}

/** "Step n of m" over the steps that apply on this device. */
export function progress(steps: readonly OnboardingStep[], current: OnboardingStep): { step: number; total: number } {
  return { step: steps.indexOf(current) + 1, total: steps.length };
}
