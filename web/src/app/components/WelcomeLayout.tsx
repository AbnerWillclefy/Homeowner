import { useSession } from "./SessionProvider";
import { LazyPage } from "./LazyPage";
import { OnboardingFallback, OnboardingFrame } from "./lazyFallbacks";
import { lazyWithReload } from "../lazyWithReload";

const Onboarding = lazyWithReload(() =>
  import("../../domains/onboarding/components/Onboarding").then((module) => ({ default: module.Onboarding })),
);

/**
 * Onboarding at /welcome/<step>: full screen, no nav and no page chrome. The guard has already put the person on
 * a valid step. The layout inside Onboarding carries the health banner and the Settings (appearance and language).
 * Its code loads on demand, so a Resident who has finished onboarding never downloads it.
 */
export function WelcomeLayout() {
  const { onboarding } = useSession();
  const state = onboarding.state;
  if (state.kind !== "ready") return null;
  return (
    <LazyPage message="onboarding.loading" skeleton={<OnboardingFallback />} frame={OnboardingFrame}>
      <Onboarding position={state.position} onPosition={onboarding.setPosition} />
    </LazyPage>
  );
}
