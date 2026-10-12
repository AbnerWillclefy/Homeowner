import { useCallback, useState } from "react";
import { putOnboardingStep, type OnboardingPosition, type OnboardingStep } from "../api/onboarding";
import type { OnboardingProblem } from "./useOnboarding";
import { effectiveStep, previousStep, stepAfter } from "./steps";

export type AdvanceState = { kind: "idle" } | { kind: "saving" } | { kind: "failed"; problem: OnboardingProblem };

/**
 * Which step is on screen. The server's step is the furthest the User has reached; Back is local and never
 * lowers it. Next moves on only after the server accepted the step, and on failure stays put. Writes are
 * never queued.
 */
export function useWalk(
  position: OnboardingPosition,
  steps: readonly OnboardingStep[],
  onPosition: (position: OnboardingPosition) => void,
) {
  const [viewing, setViewing] = useState<OnboardingStep | null>(null);
  const [advance, setAdvance] = useState<AdvanceState>({ kind: "idle" });

  const frontier = effectiveStep(steps, position);
  const current: OnboardingPosition = viewing !== null && steps.includes(viewing) ? viewing : frontier;

  const next = useCallback(async () => {
    if (current === "done" || current === "home") return;
    setAdvance({ kind: "saving" });
    const result = await putOnboardingStep(current);
    if (result.kind !== "ok") return setAdvance({ kind: "failed", problem: result.kind });
    const after = stepAfter(steps, current, result.step);
    setAdvance({ kind: "idle" });
    setViewing(after === "done" ? null : after);
    onPosition(result.step);
  }, [current, steps, onPosition]);

  const back = useCallback(() => {
    if (current === "done") return;
    const previous = previousStep(steps, current);
    if (previous === null) return;
    setAdvance({ kind: "idle" });
    setViewing(previous);
  }, [current, steps]);

  const canGoBack = current !== "done" && current !== "home" && previousStep(steps, current) !== null;

  return { current, advance, next, back, canGoBack };
}
