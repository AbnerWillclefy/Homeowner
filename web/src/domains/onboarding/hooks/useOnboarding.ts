import { useCallback, useEffect, useState } from "react";
import { getOnboarding, type OnboardingPosition } from "../api/api";

export type OnboardingProblem = "offline" | "error" | "not-signed-in";

export type OnboardingState =
  | { kind: "loading" }
  | { kind: "problem"; problem: OnboardingProblem }
  /** The step the server says to show, or `done`. */
  | { kind: "ready"; position: OnboardingPosition };

/**
 * Where the signed-in User is in onboarding, read from the server because progress has to survive leaving
 * Safari for the Home Screen app, which has its own storage. Only mounted while signed in (see App).
 * When the read fails there is no guess: the person sees the problem and can retry.
 */
export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    getOnboarding().then((result) => {
      if (cancelled) return;
      setState(result.kind === "ok" ? { kind: "ready", position: result.step } : { kind: "problem", problem: result.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const setPosition = useCallback((position: OnboardingPosition) => setState({ kind: "ready", position }), []);

  return { state, retry, setPosition };
}
