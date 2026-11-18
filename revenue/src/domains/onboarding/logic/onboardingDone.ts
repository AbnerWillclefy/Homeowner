export const ONBOARDING_DONE_KEY = "revenue.onboarding.done";

// Kept in memory too, so a browser that refuses storage still leaves Onboarding once it is finished.
let finished = false;

export function onboardingDone(): boolean {
  try {
    return finished || localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return finished;
  }
}

export function markOnboardingDone(): void {
  finished = true;
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    // Nothing to do: the in-memory flag covers this session.
  }
}
