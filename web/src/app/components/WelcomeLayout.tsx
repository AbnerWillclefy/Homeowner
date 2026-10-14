import { Onboarding } from "../../domains/onboarding/components/Onboarding";
import { useSession } from "./SessionProvider";

/**
 * Onboarding at /welcome/<step>: full screen, no nav and no page chrome. The guard has already put the person on
 * a valid step. The layout inside Onboarding carries the health banner and the Settings (appearance and language).
 */
export function WelcomeLayout() {
  const { onboarding } = useSession();
  const state = onboarding.state;
  if (state.kind !== "ready") return null;
  return <Onboarding position={state.position} onPosition={onboarding.setPosition} />;
}
