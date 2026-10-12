import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { putOnboardingStep, type OnboardingPosition, type OnboardingStep } from "../api/onboarding";
import { useSubmitOnce } from "../components/ui/useSubmitOnce";
import { stepFromPath, stepPath } from "../app/routes";
import type { OnboardingProblem } from "./useOnboarding";
import { effectiveStep, pathAfterAdvance, previousStep } from "./steps";

export type AdvanceState = { kind: "idle" } | { kind: "saving" } | { kind: "failed"; problem: OnboardingProblem };

/**
 * Which step is on screen: the one in the address (/welcome/<step>). The server's step is the furthest the User
 * has reached; Back is a navigation to an earlier step and never lowers it. Next moves on only after the server
 * accepted the step, and on failure stays put. Writes are never queued. The guard keeps the address at or
 * before the saved step; the fallback to the saved step here is only a safety net.
 */
export function useWalk(
  position: OnboardingPosition,
  steps: readonly OnboardingStep[],
  onPosition: (position: OnboardingPosition) => void,
) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [advance, setAdvance] = useState<AdvanceState>({ kind: "idle" });

  const frontier = effectiveStep(steps, position);
  const viewing = stepFromPath(pathname);
  const current: OnboardingPosition = viewing !== null && steps.includes(viewing) ? viewing : frontier;

  // Guarded in the handler: a double tap on Next sends one request, and a failure re-arms it for Retry.
  const { run: next } = useSubmitOnce(async () => {
    if (current === "done" || current === "home") return;
    setAdvance({ kind: "saving" });
    const result = await putOnboardingStep(current);
    if (result.kind !== "ok") return setAdvance({ kind: "failed", problem: result.kind });
    const path = pathAfterAdvance(steps, current, result.step);
    setAdvance({ kind: "idle" });
    // Raise the saved step first, then move, in the same tick: the guard must see both together, or it would
    // see a step ahead of the saved one and bounce back. When the walk is over there is nowhere to go; the
    // guard sends the person to Today.
    onPosition(result.step);
    if (path !== null) navigate(path);
  });

  const back = useCallback(() => {
    if (current === "done") return;
    const previous = previousStep(steps, current);
    if (previous === null) return;
    setAdvance({ kind: "idle" });
    // Never navigate(-1): a deep link has no previous entry.
    navigate(stepPath(previous));
  }, [current, steps, navigate]);

  const canGoBack = current !== "done" && current !== "home" && previousStep(steps, current) !== null;

  return { current, advance, next, back, canGoBack };
}
