import { useSession } from "./SessionProvider";
import { Onboarding } from "../onboarding/Onboarding";
import { Settings } from "../settings/Settings";
import { PageFrame } from "./PageFrame";

/** Onboarding at /welcome/<step>: full screen, no nav. The guard has already put the person on a valid step. */
export function WelcomeLayout() {
  const { onboarding } = useSession();
  const state = onboarding.state;
  return (
    <PageFrame>
      {state.kind === "ready" && <Onboarding position={state.position} onPosition={onboarding.setPosition} />}
      {/* Appearance and language stay reachable while setting up. */}
      <Settings />
    </PageFrame>
  );
}
