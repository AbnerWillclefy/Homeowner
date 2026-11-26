import type { OnboardingStep } from "../api/api";

/**
 * What the walk shows, in order: five screens over the server's six stored steps. `install` and `reminders` share
 * the last screen, because installing only matters for the reminders that follow it.
 */
export const ONBOARDING_SCREENS = ["home", "baseline", "restrictions", "preferences", "finish"] as const;
export type OnboardingScreen = (typeof ONBOARDING_SCREENS)[number];

/** The screen a stored step is shown on. */
export const screenOf = (step: OnboardingStep): OnboardingScreen =>
  step === "install" || step === "reminders" ? "finish" : step;

/** The screen for a path id: the screens' own ids, and the old step ids (a bookmark) that now share the last screen. */
export function screenFromId(id: string): OnboardingScreen | null {
  if (id === "install" || id === "reminders") return "finish";
  return (ONBOARDING_SCREENS as readonly string[]).includes(id) ? (id as OnboardingScreen) : null;
}

/** The step to report when a screen is finished or skipped. The last screen reports `reminders`: the server moves past `install` with it. */
export const reportedStep = (screen: Exclude<OnboardingScreen, "home">): Exclude<OnboardingStep, "home"> =>
  screen === "finish" ? "reminders" : screen;
